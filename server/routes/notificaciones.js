const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { enviarNotificacion } = require('../utils/notificaciones');

// Enviar notificación manual
router.post('/', auth, async (req, res) => {
  try {
    const { destinatario, asunto, mensaje } = req.body;

    await enviarNotificacion({
      destinatario,
      asunto,
      mensaje
    });

    res.json({ mensaje: 'Notificación enviada exitosamente' });
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    res.status(500).json({ error: 'Error al enviar notificación' });
  }
});

module.exports = router;
