var validator = require("validator");

function Errors() {

    var errors = {};
    var has = false;

    function isEmpty(value) {
        if (typeof value == "undefined") return true;
        if ((typeof value.length != "undefined") && (value.length == 0)) return true;
        if ((typeof value == "object") && (Object.keys(value).length == 0)) return true;
        return false;
    }

    this.clean = function() {
        errors = {};
        has = false;
        return this;
    }

    this.add = function(field, message) {
        if (!isEmpty(message)) {
            errors[field] = message;
            has = true;
        }
    };

    this.isEmpty = function(field, value, message) {
        if (isEmpty(value))
            this.add(field, typeof message != "undefined" ? message : "Invalid " + message);
        return this;
    };

    this.isURL = function(field, value, message) {
        if (isEmpty(value) || !validator.isURL(value.toString()))
            this.add(field, message);
        return this;
    };

    this.isInt = function(field, value, message) {
        if (isEmpty(value) || !value.toString().match(/^\d+$/))
            this.add(field, message);
        return this;
    };

    this.isPhone = function(field, value, message) {
        if (isEmpty(value) || !value.toString().replace(/[\-\(\)]/g, "").match(/^\+{0,1}\d{6,}$/))
            this.add(field, message);
        return this;
    }

    this.get = function() {
        return errors;
    };

    this.has = function() {
        return has;
    }

    this.dump = function() {
        console.log(errors);
    };
}

module.exports = new Errors();