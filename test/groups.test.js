import '@babel/register';
import "regenerator-runtime/runtime";
import Model from '../src/api/authGroup/model';
import dal from '../src/api/authGroup/dal';
import helper from '../src/helper';
import group from '../src/api/authGroup/group';
import { AccountMocks, GroupMocks } from './models';
const mockingoose = require('mockingoose');
import t from './testhelper';
import bcrypt from "bcryptjs";

describe('Auth Groups', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockingoose.resetAll();
        Model.Query.prototype.findOne.mockClear();
    });

    it('Create a group with default active as false and locked as false', async () => {
        try {
            const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
            const expected = JSON.parse(JSON.stringify(grp));
            expected.id = expected._id;
            delete expected._id;
            delete expected.active;
            delete expected.owner;
            delete expected.__v;
            mockingoose(Model).toReturn(grp, 'save');
            const data = {
                "name": grp.name,
                "prettyName": grp.prettyName,
                "owner": "test@unitedeffects.com",
                "locked": false,
                "primaryDomain": "unitedeffects.com",
                "primaryEmail": "info@unitedeffects.com"
            };
            const spy = jest.spyOn(dal, "write");
            const result = await group.write(data);
            expect(spy).toHaveBeenCalled();
            const calledDalWith = spy.mock.calls[0][0];
            expect(calledDalWith.securityExpiration).toBeDefined();
            expect(calledDalWith.primaryDomain).toBe('https://unitedeffects.com');
            expect(calledDalWith.active).toBe(false);
            expect(Model.prototype.save).toHaveBeenCalled();

            // lets simulate the mongoose constructor to validate our defaults
            const tempGroup = new Model(calledDalWith);
            expect(tempGroup.active).toBe(false);
            expect(tempGroup.owner).toBe('test@unitedeffects.com');
            expect(tempGroup.name).toBe(expected.name);
            expect(tempGroup.prettyName).toBe(expected.prettyName);
            expect(tempGroup.securityExpiration).toBe(calledDalWith.securityExpiration);
            expect(tempGroup.pluginOptions.notification.enabled).toBe(false);
            expect(tempGroup.config.centralPasswordReset).toBe(true);
            expect(tempGroup.config.requireVerified).toBe(false);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    /**
     * Attempt notification=false + passwordless true = passworldess false
     * Attempt notification=false + locked true + requiredVerify true = required Verify false
     * @param body
     * @returns {Promise<*>}
     */
    it('Create a group with active and passwordless as true - both should remain false', async () => {
        try {
            const grp = GroupMocks.newGroup('TEST', 'tst', true, false);
            const expected = JSON.parse(JSON.stringify(grp));
            expected.id = expected._id;
            delete expected._id;
            delete expected.active;
            delete expected.owner;
            delete expected.__v;
            mockingoose(Model).toReturn(grp, 'save');
            const data = {
                "name": grp.name,
                "prettyName": grp.prettyName,
                "owner": "test@unitedeffects.com",
                "locked": false,
                "primaryDomain": "unitedeffects.com",
                "primaryEmail": "info@unitedeffects.com",
                "config": {
                    "passwordLessSupport": true
                }
            };
            const spy = jest.spyOn(dal, "write");
            const result = await group.write(data);
            expect(spy).toHaveBeenCalled();
            const calledDalWith = spy.mock.calls[0][0];
            expect(calledDalWith.securityExpiration).toBeDefined();
            expect(calledDalWith.primaryDomain).toBe('https://unitedeffects.com');
            expect(calledDalWith.active).toBe(false);
            expect(calledDalWith.config.passwordLessSupport).toBe(false);
            expect(Model.prototype.save).toHaveBeenCalled();

            // lets simulate the mongoose constructor to validate our defaults
            const tempGroup = new Model(calledDalWith);
            expect(tempGroup.active).toBe(false);
            expect(tempGroup.owner).toBe('test@unitedeffects.com');
            expect(tempGroup.name).toBe(expected.name);
            expect(tempGroup.prettyName).toBe(expected.prettyName);
            expect(tempGroup.securityExpiration).toBe(calledDalWith.securityExpiration);
            expect(tempGroup.pluginOptions.notification.enabled).toBe(false);
            expect(tempGroup.config.centralPasswordReset).toBe(true);
            expect(tempGroup.config.requireVerified).toBe(false);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });
    /*
    it('Create an account without username', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(AccountMocks.account));
            expected.id = expected._id;
            delete expected.blocked;
            delete expected._id;
            delete expected.password;
            delete expected.__v;
            mockingoose(Model).toReturn(AccountMocks.account, 'save');
            const data = {
                email: AccountMocks.account.email.toUpperCase(), //making sure it comes back lowercase
                password: 'testpass',
                authGroup: AccountMocks.account.authGroup
            };
            const spy = jest.spyOn(dal, "writeAccount");
            const result = await account.writeAccount(data);
            expect(spy).toHaveBeenCalledWith({ ...data, username: AccountMocks.account.email });
            expect(Model.prototype.save).toHaveBeenCalled();
            expect(result.email).toBe(AccountMocks.account.email);
            expect(result.username).toBe(AccountMocks.account.username);
            expect(result.password).toBe(AccountMocks.account.password);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('get one account', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(AccountMocks.account));
            expected.id = expected._id;
            delete expected.blocked;
            delete expected._id;
            delete expected.password;
            delete expected.__v;
            mockingoose(Model).toReturn(AccountMocks.account, 'findOne');
            const result = await account.getAccount(AccountMocks.account.authGroup, AccountMocks.account._id);
            expect(Model.Query.prototype.findOne).toHaveBeenCalledWith({ "_id": AccountMocks.account._id, "authGroup": AccountMocks.account.authGroup }, undefined);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('get accounts - no filters', async () => {
        try {
            const randomCount = Math.floor(Math.random() * 11);
            const multiAccounts = AccountMocks.accounts(randomCount, true);
            const expected = JSON.parse(JSON.stringify(multiAccounts));
            for(let i=0; i<randomCount; i++) {
                expected[i].id = expected[i]._id;
                delete expected[i].blocked;
                delete expected[i]._id;
                delete expected[i].password;
                delete expected[i].__v;
            }
            mockingoose(Model).toReturn(multiAccounts, 'find');
            const spy = jest.spyOn(helper, 'parseOdataQuery');
            const result = await account.getAccounts(AccountMocks.account.authGroup, {});
            expect(spy).toHaveBeenCalledWith({});
            expect(Model.Query.prototype.find).toHaveBeenCalledWith({ authGroup: AccountMocks.account.authGroup }, undefined);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('patch an account', async () => {
        try {
            const oneAccount = AccountMocks.account;
            const oneGroup = GroupMocks.group;
            const expected = JSON.parse(JSON.stringify(oneAccount));

            // we will update the doc to this
            expected.email = "updated@unitedeffects.com";
            const patched = JSON.parse(JSON.stringify(expected));

            mockingoose(Model).toReturn(patched, 'findOneAndUpdate');
            mockingoose(Model).toReturn(oneAccount, 'findOne');

            // ignoring these since they are dynamic
            delete patched.createdAt;
            delete patched.modifiedAt;

            // cleanup expected
            expected.id = expected._id;
            delete expected.blocked;
            delete expected._id;
            delete expected.password;
            delete expected.__v;
            const update = [
                {
                    "op":"replace",
                    "path":"/email",
                    "value": expected.email
                }
            ];
            const result = await account.patchAccount(oneGroup, oneAccount._id, update, oneAccount._id, false);
            expect(Model.Query.prototype.findOne).toHaveBeenCalledWith({ "_id": oneAccount._id, "authGroup": oneGroup._id }, undefined);
            expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ "_id": oneAccount._id, "authGroup": oneGroup._id }, expect.objectContaining(patched), { "new": true, "overwrite": true}, undefined);
            const res = JSON.parse(JSON.stringify(result));

            // ignoring these since they are dynamic - we do this by just setting to the actual result so check passes
            expected.createdAt = res.createdAt;
            expected.modifiedAt = res.modifiedAt;

            //check final expected result
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('get one account by username', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(AccountMocks.account));
            expected.id = expected._id;
            delete expected.blocked;
            delete expected._id;
            delete expected.password;
            delete expected.__v;
            mockingoose(Model).toReturn(AccountMocks.account, 'findOne');

            // testing that case does not matter as I do this
            const result = await account.getAccountByEmailOrUsername(
                AccountMocks.account.authGroup,
                AccountMocks.account.username.toUpperCase()
            );
            const query =     {
                authGroup: AccountMocks.account.authGroup,
                blocked: false,
                active: true,
                '$or': [
                    { email: AccountMocks.account.username },
                    { username: AccountMocks.account.username }
                ]
            }
            expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('get one account by email', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(AccountMocks.account));
            expected.id = expected._id;
            delete expected.blocked;
            delete expected._id;
            delete expected.password;
            delete expected.__v;
            mockingoose(Model).toReturn(AccountMocks.account, 'findOne');

            // testing that case does not matter as I do this
            const result = await account.getAccountByEmailOrUsername(
                AccountMocks.account.authGroup,
                AccountMocks.account.email.toUpperCase()
            );
            const query =     {
                authGroup: AccountMocks.account.authGroup,
                blocked: false,
                active: true,
                '$or': [
                    { email: AccountMocks.account.email },
                    { username: AccountMocks.account.email }
                ]
            }
            expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('update password only', async () => {
        try {
            const newPass = 'new-password-123';
            const oneAccount = AccountMocks.account;
            const expected = JSON.parse(JSON.stringify(oneAccount));
            expected.modifiedBy = 'TEST';
            const updated = JSON.parse(JSON.stringify(expected));
            expected.id = expected._id;
            delete expected.blocked;
            delete expected._id;
            delete expected.password;
            delete expected.__v;
            // random hash - value not important
            updated.password = '$2a$10$BIFS5/ldwZjtXa3RrW9kK.rRKjeb/jf/7haIwlWXaRp5.J/xAOt7a';
            mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
            const result = await account.updatePassword(
                AccountMocks.account.authGroup,
                AccountMocks.account._id,
                newPass,
                'TEST');
            expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith(
                { "_id": AccountMocks.account._id, "authGroup": AccountMocks.account.authGroup },
                expect.objectContaining({ modifiedBy: 'TEST' }),
                { "new": true },
                undefined);

            // ensure we are hashing the password correctly since its handled in function and not mongoose middleware
            const argument = Model.Query.prototype.findOneAndUpdate.mock.calls[0][1];
            const hashedPassword = argument.password;
            const isMatch = await bcrypt.compare(newPass, hashedPassword);
            expect(isMatch).toBe(true);

            // make sure response is what we expected
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    })

     */
});