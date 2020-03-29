import Default from "./default";
import Session from "./session";


// todo - add other models

function getModel (name) {
    switch (name) {
        case Session.modelName:
            return Session;
        default:
            return Default(name);
    }
}

export default getModel;