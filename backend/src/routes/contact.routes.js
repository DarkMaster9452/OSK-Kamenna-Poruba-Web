const express = require('express');
const { z } = require('zod');
const { validateBody } = require('../middleware/validate');
const { sendContactFormEmail } = require('../services/email.service');

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(4000)
});

router.post('/', validateBody(contactSchema), async (req, res, next) => {
  const { name, email, message } = req.body;

  try {
    await sendContactFormEmail({ name, email, message });
    return res.json({ message: 'Správa bola úspešne odoslaná.' });
  } catch (error) {
    if (error && (error.code === 'SMTP_NOT_CONFIGURED' || error.code === 'CONTACT_RECIPIENT_NOT_CONFIGURED')) {
      return res.status(503).json({
        message: 'E-mailová služba momentálne nie je dostupná. Skúste to prosím neskôr.'
      });
    }

    return next(error);
  }
});

module.exports = router;
