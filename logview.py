from __future__ import print_function

from gevent import monkey
monkey.patch_all()
import gevent

import sys
import argparse
import os.path
from socketio import socketio_manage
from socketio.server import SocketIOServer
from socketio.namespace import BaseNamespace
import select

from backend.userdata import read_user_data, write_user_data

# Arbitrarily chosen max amount of lines that can be sent in one
# websocket message.  Too many messages in short succession slows
# everything down a lot.
MAX_LINES_IN_ONE_GO = 1000

# Global initialized at program startup
user_data_file = None


class GlobalNamespace(BaseNamespace):
    def on_need_code(self):
        self.emit('code', read_user_data(user_data_file))

    def on_save_rules(self, rules):
        data = read_user_data(user_data_file)
        write_user_data(user_data_file,
                        data['columns'], data['parse_line'], rules)

    @staticmethod
    def stdin_has_data():
        return select.select([sys.stdin], [], [], 0.0)[0]

    def on_need_logs(self):
        def emit_from_stdin():
            eof = False
            while not eof:
                gevent.socket.wait_read(sys.stdin.fileno())

                # gevent has told us we have data waiting, now collect
                # as much as allowed
                lines = []
                while (self.stdin_has_data() and
                       len(lines) < MAX_LINES_IN_ONE_GO):
                    line = sys.stdin.readline()
                    if not line:
                        eof = True
                        break
                    lines.append(line.rstrip("\n"))

                self.emit('loglines', lines)

        self.spawn(emit_from_stdin)


class Application(object):
    def _not_found(self, start_response):
        start_response('404 Not Found', [])
        return ['<h1>Not Found</h1>']

    def _is_static_path(self, path):
        return (path.startswith('css/') or
                path.startswith('js/') or
                path.startswith('fonts/') or
                path == 'index.html')

    def _static_content(self, path, start_response):
        try:
            with open(os.path.join('ui', path)) as f:
                data = f.read()
        except IOError:
            return self._not_found(start_response)

        if path.endswith('.js'):
            content_type = 'text/javascript'
        elif path.endswith('.css'):
            content_type = 'text/css'
        else:
            content_type = 'text/html'

        start_response('200 OK', [('Content-Type', content_type)])
        return [data]

    def __call__(self, environ, start_response):
        path = environ['PATH_INFO'].strip('/')
        if not path:
            path = 'index.html'

        if self._is_static_path(path):
            return self._static_content(path, start_response)
        elif path.startswith('socket.io'):
            socketio_manage(environ, {'': GlobalNamespace})

        return self._not_found(start_response)


def parse_arguments():
    parser = argparse.ArgumentParser(description='Read logfiles')
    parser.add_argument('-u', '--user-file',
                        default='user.xml',
                        help='path to user file')
    return parser.parse_args()

def main():
    global user_data_file
    args = parse_arguments()
    user_data_file = args.user_file
    print('Listening on port 8080')
    SocketIOServer(('0.0.0.0', 8080), Application(),
                   resource='socket.io', policy_server=False).serve_forever()
    return 0

if __name__ == '__main__':
    sys.exit(main())
