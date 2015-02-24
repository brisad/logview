from lxml import etree

def _get_table_columns(tree):
    return [col.strip() for col in tree.find('table-columns').text.split(',')]

def _get_parse_line(tree):
    return tree.find('parse-line').text.strip()

def _get_rules(tree):
    return [{'name': rule.get('name').strip(), 'funcText': rule.text.strip()}
            for rule in tree.iter('rule')]

def _rule_to_xml(rule):
    return '<rule name="{}">\n{}\n</rule>\n'.format(
        rule['name'], rule['funcText'])

def read_user_data(filename='user.xml'):
    tree = etree.parse(filename)
    return {'columns': _get_table_columns(tree),
            'parse_line': _get_parse_line(tree),
            'rules': _get_rules(tree)}

def write_user_data(filename, table_columns, parse_line, rules):
    BASE_XML = """<user>

<table-columns>
{table_columns}
</table-columns>

<parse-line>
{parse_line}
</parse-line>

{rules}
</user>
"""

    # Instead of using lxml-functions to create the elements, we
    # create a customized string with the intention of not letting the
    # tags get in the user's way.
    root = etree.XML(BASE_XML.format(
        table_columns=", ".join(table_columns),
        parse_line=parse_line,
        rules="\n".join(_rule_to_xml(rule) for rule in rules)))

    etree.ElementTree(root).write(filename)

if __name__ == '__main__':
    write_user_data("output.xml", "a,b,c", "function () {}",
                    [{"name": "rule 1", "funcText": "X"},
                     {"name": "rule 2", "funcText": "Y\nZ"}])

