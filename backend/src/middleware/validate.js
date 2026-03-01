function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Neplatné vstupy',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    req.body = parsed.data;
    return next();
  };
}

module.exports = {
  validateBody
};