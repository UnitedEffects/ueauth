export default {
    async responseIntercept (req, res, next) {
        res.respond = function(output) {
            try {
                const status = output.statusCode;
                delete output.statusCode;
                return this.status(status || 200).json(output);
            } catch (error) {
                next(error);
            }
        };
        next();
    }
}