"use strict";

function refreshScrollSpy() {
  $('[data-spy="scroll"]').each(function () {
    $(this).scrollspy('refresh')
  });
}

var LogViewer = React.createClass({
  componentDidUpdate: function (prevProps, prevState) {
    /* Update ScrollSpy when DOM is modified */
    refreshScrollSpy();
  },

  getInitialState: function () {
    return {rules: [], logs: []};
  },

  componentDidMount: function () {
    this.setState({rules: this.props.rules});

    DataSource.listenForLogs(
      this.props.parseLine,

      function (messages) {
        this.setState({logs: this.state.logs.concat(messages)});
      }.bind(this),

      function (line, exception) {
        alert("Exception raised for line: " + line + "\n\n" + exception);
        // this.setState({logs: this.state.logs.concat({ invalid: true, line: line, exception: exception })});
      }.bind(this));
  },

  handleEnableRule: function (index, enabled) {
    var rules;
    if (enabled) {
      rules = Rules.enableRule(this.state.rules, index);
    } else {
      rules = Rules.disableRule(this.state.rules, index);
    }
    this.setState({rules: rules});
  },

  handleRuleChange: function (index, code) {
    var rules = Rules.changeRule(this.state.rules, index, code);
    this.setState({rules: rules});
  },

  /* Attempts to move the specified rule one step up or down.
   * |setState| is called and this function returns true on success.
   * On error no state is changed and false is returned.
   */
  handleRuleReorder: function (index, direction) {
    var rules;
    if (direction == "up") {
      rules = Rules.moveRuleUp(this.state.rules, index);
    } else {
      rules = Rules.moveRuleDown(this.state.rules, index);
    }

    // Check if reorder didn't work
    if (rules == null) {
      return false;
    }

    this.setState({rules: rules});
    return true;
  },

  handleAddRule: function (index) {
    var rules = Rules.addRuleAt(this.state.rules, index);
    this.setState({rules: rules});
  },

  handleDeleteRule: function (index) {
    var rules = Rules.deleteRule(this.state.rules, index);
    this.setState({rules: rules});
  },

  handleRuleNameChange: function (index, name) {
    var rules = Rules.renameRule(this.state.rules, index, name);
    this.setState({rules: rules});
  },

  handleReloadRules: function () {
    // Ask server for user data again, but we're only interested in
    // the rules now.
    User.fetchUserData().done(function (data) {
      var rules = Rules.init(data.rules);
      this.setState({rules: rules});
    }.bind(this)).fail(function (err) {
      console.log(err);
    });
  },

  handleSaveRules: function () {
    if (confirm("This will overwrite your rules!")) {
      User.saveRules(Rules.serialize(this.state.rules));
    }
  },

  render: function () {
    var result = Rules.applyAll(this.state.rules, this.state.logs);
    var logs = result.logs;
    var navs = result.navs;

    return (
      <div>
        <div className="main row">
          <div className="col-xs-2 sidebar">
            <Navigation data={navs} />
          </div>
          <div className="col-xs-10 col-xs-offset-2 logs" data-spy="scroll">
            <Logs data={logs} columns={this.props.columns} />
          </div>
        </div>
        <div className="footer row">
          <Pane
            rules={this.state.rules}
            onEnableRule={this.handleEnableRule}
            onRuleChange={this.handleRuleChange}
            onRuleReorder={this.handleRuleReorder}
            onAddRule={this.handleAddRule}
            onDeleteRule={this.handleDeleteRule}
            onNameChange={this.handleRuleNameChange}
            onReloadRules={this.handleReloadRules}
            onSaveRules={this.handleSaveRules}
          />
        </div>
      </div>
    );
  }
});

var Navigation = React.createClass({
  render: function () {
    var navItems = this.props.data.map(function (nav) {
      var cls = "list-group-item";
      if (nav.level !== undefined) {
        cls += " list-group-item-" + nav.level;
      }

      var target = "#msg-" + nav.target;
      return (
        <li key={target}>
          <a href={target} className={cls}>
            {nav.caption}
          </a>
        </li>
      );
    }, this);

    return (
      <ul className="nav nav-pills nav-stacked">
        {navItems}
      </ul>
    );
  }
});

var Logs = React.createClass({
  render: function () {
    var tableHeads = this.props.columns.map(function (column) {
      return <th key={"column-" + column}>{column}</th>;
    });

    var logMessages = this.props.data.map(function (message, i) {
      if (message.annotation) {
        return (
          <tr id={"msg-" + message.id}>
            <td colSpan={this.props.columns.length}>
              <div className={"alert alert-" + message.level}>
                {message.text}
              </div>
            </td>
          </tr>
        );
      }
      return (
        <LogMessage
          columns={this.props.columns}
          level={message.level}
          data={message.data}
          key={message.id}
          id={message.id}
        />
      );
    }, this);

    return (
      <table className="table table-hover table-condensed">
        <thead><tr>
          {tableHeads}
        </tr></thead>
        <tbody>
          {logMessages}
        </tbody>
      </table>
    );
  }
});

var LogMessage = React.createClass({
  //mixins: [React.addons.PureRenderMixin],

  render: function () {
    var tableData = this.props.columns.map(function (column) {
      return <td key={column}>{this.props.data[column]}</td>;
    }, this);

    return (
      <tr className={this.props.level} id={"msg-" + this.props.id}>
        {tableData}
      </tr>
    );
  }
});

var Pane = React.createClass({
  /* The state |selected| is the index of the currently selected rule
   * in the pane.  If -1, none is selected.
   */
  getInitialState: function () {
    return {selected: -1};
  },

  componentDidMount: function () {
    if (this.props.rules.length > 0) {
      this.setState({selected: 0});
    }
  },

  handleChangeRule: function (index) {
    this.setState({selected: index});
  },

  handleEnableChange: function (index, enabled) {
    this.props.onEnableRule(index, enabled);
  },

  handleCodeChange: function (code) {
    if (this.state.selected == -1)
      return;
    this.props.onRuleChange(this.state.selected, code);
  },

  handleReorder: function (direction) {
    if (!(direction == "up" || direction == "down")) {
      throw new Error("Invalid direction");
    }

    // Nothing to do if nothing is selected
    if (this.state.selected == -1)
      return;

    /* The parent doesn't know about our selection state so we need to
     * update it here ourselves, by checking the return value of the
     * handler to see if we need to increment or decrement the
     * selection index.
     */
    if (!this.props.onRuleReorder(this.state.selected, direction)) {
      return;
    }

    if (direction == "up") {
      this.setState({selected: this.state.selected - 1});
    } else {
      this.setState({selected: this.state.selected + 1});
    }
  },

  handleAddRule: function () {
    if (this.state.selected == -1) {
      // If no rule is selected (meaning the list is empty), add one
      // at the top and then mark it selected
      this.props.onAddRule(0);
      this.setState({selected: 0});
    } else {
      this.props.onAddRule(this.state.selected);
    }
  },

  handleDeleteRule: function () {
    // Nothing to do if nothing is selected
    if (this.state.selected == -1)
      return;

    this.props.onDeleteRule(this.state.selected);
    if (this.state.selected == this.props.rules.length - 1) {
      this.setState({selected: this.props.rules.length - 2});
    }
  },

  handleNameChange: function (event) {
    if (this.state.selected == -1)
      return;
    this.props.onNameChange(this.state.selected, event.target.value);
  },

  handleReloadRules: function () {
    this.props.onReloadRules();
  },

  handleSaveRules: function () {
    this.props.onSaveRules();
  },

  _codeToShow: function () {
    var code;
    if (this.state.selected in this.props.rules) {
      code = this.props.rules[this.state.selected].funcText;
    } else {
      code = "";
    }
    return code;
  },

  _errorToShow: function () {
    var error;
    if (this.state.selected in this.props.rules) {
      error = this.props.rules[this.state.selected].broken;
      if (error) return error;
    }
    return "";
  },

  render: function () {
    var ruleSelectionList = this.props.rules.map(function (rule, index) {
      return (
        <RuleSelection
          ruleName={rule.name}
          key={index}
          index={index}
          isChecked={!('disabled' in rule)}
          isSelected={this.state.selected == index}
          isDisabled={rule.broken}
          onEnableChange={this.handleEnableChange}
          onRuleSelect={this.handleChangeRule}
        />
      );
    }, this);

    var selectedRuleName = (this.state.selected != -1) ?
        this.props.rules[this.state.selected].name : "";

    return (
      <div className="pane">
        <div className="rule-list col-xs-3">
          <div className="items list-group">
            {ruleSelectionList}
          </div>
          <div className="buttons">
            <RuleListButtons
              onReorder={this.handleReorder}
              onAdd={this.handleAddRule}
              onDelete={this.handleDeleteRule}
            />
          </div>
          <div className="persistence-buttons">
            <RulePersistenceButtons
              onReload={this.handleReloadRules}
              onSave={this.handleSaveRules}
            />
          </div>
        </div>
        <div className="rule-contents col-xs-6">
          <input type="text"
            className="form-control"
            value={selectedRuleName}
            onChange={this.handleNameChange}
          />
          <RuleCodeArea
            code={this._codeToShow()}
            onCodeChange={this.handleCodeChange}
          />
          <input
            className="form-control"
            type="text"
            value={this._errorToShow()}
            readOnly
          />
        </div>
      </div>
    );
  }
});

var RuleSelection = React.createClass({
  onSelect: function () {
    this.props.onRuleSelect(this.props.index);
  },

  onEnableChange: function () {
    this.props.onEnableChange(this.props.index, !this.props.isChecked);
  },

  render: function () {
    var className = "list-group-item" +
        (this.props.isSelected ? " active": "") +
        (this.props.isDisabled ? " disabled": "");
    return (
      <a href="#" className={className} onClick={this.onSelect}>
        <input
          type="checkbox"
          checked={this.props.isChecked}
          onChange={this.onEnableChange}
        />
        &nbsp;
        {this.props.ruleName}
      </a>
    );
  }
});

var RuleListButtons = React.createClass({
  handleUp: function () {
    this.props.onReorder("up");
  },

  handleDown: function () {
    this.props.onReorder("down");
  },

  handleAdd: function () {
    this.props.onAdd();
  },

  handleDelete: function () {
    this.props.onDelete();
  },

  _makeButton: function (icon, onClick) {
    return (
      <button type="button" className="btn btn-default" onClick={onClick} >
        <span className={"glyphicon glyphicon-" + icon}></span>
      </button>
    );
  },

  render: function () {
    return (
      <div className="btn-group-vertical">
        {this._makeButton("arrow-up", this.handleUp)}
        {this._makeButton("arrow-down", this.handleDown)}
        {this._makeButton("plus", this.handleAdd)}
        {this._makeButton("remove", this.handleDelete)}
      </div>
    );
  }
});

var RulePersistenceButtons = React.createClass({

  handleReload: function () {
    this.props.onReload();
  },

  handleSave: function () {
    this.props.onSave();
  },

  render: function () {
    return (
      <div>
        <button
          type="button"
          className="btn btn-default"
          onClick={this.handleReload}
        >
          Reload rules
        </button>
        <button
          type="button"
          className="btn btn-default"
          onClick={this.handleSave}
        >
          Save rules
        </button>
      </div>
    );
  }
});

var RuleCodeArea = React.createClass({
  onChange: function (event) {
    this.props.onCodeChange(event.target.value);
  },

  render: function () {
    return (
      <CodeMirrorEditor
        className="code-area"
        textAreaClassName="form-control code-area"
        value={this.props.code}
        mode="javascript"
        //theme="solarized"
        lineNumbers={true}
        onChange={this.onChange}
      />
    );
  }
});

User.fetchUserData().done(function (userData) {
  React.render(
    <LogViewer
      parseLine={userData.parseLine}
      rules={Rules.init(userData.rules)}
      columns={userData.tableColumns}
    />,
    document.getElementById('content')
  );
}).fail(function (errorMessage) {
  alert("Loading of user data failed:\n" + errorMessage);
});
