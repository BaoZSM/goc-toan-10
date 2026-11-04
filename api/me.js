// GET /api/me — ai đang đăng nhập
const T = require("./_tk");
module.exports = T.guard(async (req, res, { me }) => T.send(res, 200, { user: me.user, name: me.ten, quyen: me.quyen }));
