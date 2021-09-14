import { v4 as uuid } from 'uuid';

const pmocks = {
    global: {
        "_id": uuid(),
        "notifications": {
            "enabled": false
        },
        "createdAt": "2021-08-23T15:51:18.634Z",
        "createdBy": "test@unitedeffects.com",
        "version": 1,
        "__v": 0
    },
    notification(bNot = true) {
        const out = JSON.parse(JSON.stringify(pmocks.global));
        out.notifications.enabled = bNot;
        return out;
    }
};

export default pmocks