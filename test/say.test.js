import '@babel/register';
import "regenerator-runtime/runtime";
import { say, sayMiddleware } from '../src/say';

describe('Say library tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('say created', async () => {
        expect(say.created({success: 'ok'}, 'TEST')).toStrictEqual({
            statusCode: 201,
            type: 'TEST',
            data: { success: 'ok' }
        })
    });
    it('say ok', async () => {
        expect(say.ok({success: 'ok'}, 'TEST')).toStrictEqual({
            statusCode: 200,
            type: 'TEST',
            data: { success: 'ok' }
        })
    });
    it('say no content', async () => {
        expect(say.noContent('TEST')).toStrictEqual({
            statusCode: 204,
            type: 'TEST',
        })
    });
    it('say accepted', async () => {
        expect(say.accepted({ info: 'accepted'}, 'TEST')).toStrictEqual({
            statusCode: 202,
            type: 'TEST',
            data: { info: 'accepted' }
        })
    });
    it('say partial', async () => {
        expect(say.partial({ info: 'partial'}, 'TEST')).toStrictEqual({
            statusCode: 206,
            type: 'TEST',
            data: { info: 'partial' }
        })
    });
    it('say specific response', async () => {
        expect(say.specifically(420, { info: 'info'}, 'TEST', 'ERROR', 'A MESSAGE')).toStrictEqual({
            statusCode: 420,
            type: 'TEST',
            data: { info: 'info' },
            error: 'ERROR',
            message: 'A MESSAGE'
        })
    });
    it('intercepts response and adds respond as a function', async () => {
        try {
            const req = {};
            const mockRes = () => {
                const out = {};
                out.status = jest.fn().mockReturnValue(out);
                out.json = jest.fn().mockReturnValue(out);
                return out;
            };
            const res = mockRes();
            await sayMiddleware.responseIntercept(req, res, (err) => {
                expect(err).toBe(undefined);
                res.respond(say.partial({ a: 'test' }, 'TEST'));
                expect(res.status).toHaveBeenCalledWith(206);
                expect(res.json).toHaveBeenCalledWith({ type: "TEST", data: { a: 'test' }});
            })
        } catch (error) {
            console.error(error);
            fail();
        }

    })
});