// Small helpers shared by controllers.
const page = (query) => {
  const pageNo = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
  return { limit: pageSize, offset: (pageNo - 1) * pageSize, pageNo, pageSize };
};

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

module.exports = { page, pick };
