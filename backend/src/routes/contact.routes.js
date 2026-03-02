const express = require('express');
const { z } = require('zod');
const { validateBody } = require('../middleware/validate');
const { sendContactFormEmail } = require('../services/email.service');

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Meno musí mať aspoň 2 znaky.').max(120, 'Meno je príliš dlhé.'),
  email: z.string().trim().email('Zadajte platný email.').max(254, 'Email je príliš dlhý.'),
  message: z.string().trim().min(3, 'Správa musí mať aspoň 3 znaky.').max(4000, 'Správa je príliš dlhá.')
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
