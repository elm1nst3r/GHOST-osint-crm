// How a connection reads from the other person's side (#112): if A is B's
// employer, B is A's employee. Every other type (family, associate, …) reads
// the same both ways. Mirrored in frontend/src/utils/connectionTypes.js.
const REVERSE_TYPE = { employer: 'employee', employee: 'employer' };

const reverseConnectionType = (type) => REVERSE_TYPE[type] || type || 'other';

module.exports = { reverseConnectionType, REVERSE_TYPE };
