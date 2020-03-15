export default {
    isJson(check) {
        try {
            JSON.parse(check);
            return true;
        } catch (e) {
            return false;
        }
    },
    elementExists(property, check, arr) {
        return arr.some(function(el) {
            return el[property] === check;
        });
    }
};