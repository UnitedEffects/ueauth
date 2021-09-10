import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';

const acMocks = {
    account: {
        "_id":"fe031227-e90b-444b-81cb-29bfc2b64810",
        "createdAt":"2021-08-23T15:51:17.501Z",
        "modifiedAt":"2021-09-07T17:40:36.081Z",
        "modifiedBy":"fe031227-e90b-444b-81cb-29bfc2b64810",
        "blocked":false,
        "verified":false,
        "active":true,
        "username":"test@unitedeffects.com",
        "email":"test@unitedeffects.com",
        "password":"$2a$10$HlxjkhpitJOn8wQzrO7GUeC16p866Z3DaJD1Mb5ua8DVZmSfKbIDe",
        "authGroup":"X2lgt285uWdzq5kKOdAOj",
        "__v":0
    },
    randomAccount () {
        let act = JSON.parse(JSON.stringify(acMocks.account));
        act._id = uuid();
        act.username = `${nanoid()}@unitedeffects.com`;
        act.email = act.username;
        act.verified = true;
        act.active = true;
        return act;
    },
    accounts (count, verified = undefined, unSameAsEm = true) {
        const output = [];
        for(let i = 0; i<count; i++) {
            let temp = JSON.parse(JSON.stringify(acMocks.account));
            temp._id = uuid();
            temp.username = `${nanoid()}@unitedeffects.com`;
            if(unSameAsEm === true) temp.email = temp.username;
            else temp.email = `${nanoid()}@unitedeffects.com`;
            if(verified !== undefined) {
                temp.verified = verified;
            }
            output.push(temp);
        }
        return output;
    }
}

export default acMocks;