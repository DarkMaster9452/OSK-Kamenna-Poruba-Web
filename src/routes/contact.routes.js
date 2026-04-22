const express = require('express');
const { z } = require('zod');
const { validateBody } = require('../middleware/validate');
const { sendContactFormEmail } = require('../services/email.service');
const { verifyRecaptchaToken } = require('../services/recaptcha.service');
const env = require('../config/env');

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Meno musí mať aspoň 2 znaky.').max(120, 'Meno je príliš dlhé.'),
  email: z.string().trim().email('Zadajte platný email.').max(254, 'Email je príliš dlhý.'),
  phone: z.string().trim().min(5, 'Telefónne číslo musí mať aspoň 5 znakov.').max(30, 'Telefónne číslo je príliš dlhé.'),
  message: z.string().trim().min(3, 'Správa musí mať aspoň 3 znaky.').max(4000, 'Správa je príliš dlhá.'),
  recaptchaToken: z.string().min(1).max(2048).optional()
});

router.post('/', validateBody(contactSchema), async (req, res, next) => {
  const { name, email, phone, message, recaptchaToken } = req.body;

  try {
    if (env.recaptchaApiKey && env.recaptchaProjectId && recaptchaToken) {
      try {
        const captcha = await verifyRecaptchaToken(recaptchaToken, 'contact');
        if (!captcha.valid || captcha.score < env.recaptchaScoreThreshold) {
          console.warn('[contact] reCAPTCHA failed:', captcha);
          return res.status(400).json({ message: 'Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.' });
        }
      } catch (captchaError) {
        console.error('[contact] reCAPTCHA verification error:', captchaError.message);
        // Continue – don't block email on reCAPTCHA API failure
      }
    }

    await sendContactFormEmail({ name, email, phone, message });
    return res.json({ message: 'Správa bola úspešne odoslaná.' });
  } catch (error) {
    if (error && error.code === 'RECAPTCHA_NOT_CONFIGURED') {
      try {
        await sendContactFormEmail({ name, email, phone, message });
        return res.json({ message: 'Správa bola úspešne odoslaná.' });
      } catch (emailError) {
        return next(emailError);
      }
    }

    if (error && (error.code === 'SMTP_NOT_CONFIGURED' || error.code === 'CONTACT_RECIPIENT_NOT_CONFIGURED')) {
      return res.status(503).json({
        message: 'E-mailová služba momentálne nie je dostupná. Skúste to prosím neskôr.'
      });
    }

    return next(error);
  }
});

module.exports = router;
