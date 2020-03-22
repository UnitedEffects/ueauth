import Access from 'accesscontrol';

const ac = new Access();

ac.grant(['guest']);

ac.grant(['superAdmin'])
    .extend('guest')
    .createAny('logs')
    .updateAny('logs')
    .readAny('logs')
    .deleteAny('logs');

export default ac;