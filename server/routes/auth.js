const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const { 
  enviarEmailVerificacion, 
  enviarCodigoCambioContrasena, 
  enviarCodigoRegistro,
  generarCodigoNumerico 
} = require('../utils/email');

// Paso 1: Solicitar código de registro
router.post('/solicitar-codigo-registro', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Este correo ya está registrado' });
    }

    // Generar código numérico de 6 dígitos
    const codigo = generarCodigoNumerico();
    const codigoExpira = new Date();
    codigoExpira.setMinutes(codigoExpira.getMinutes() + 10); // Expira en 10 minutos

    // Guardar código temporalmente (usaremos una colección temporal o memoria)
    // Por simplicidad, guardaremos en una variable global temporal
    global.codigosRegistroPendientes = global.codigosRegistroPendientes || {};
    global.codigosRegistroPendientes[email] = {
      codigo,
      expira: codigoExpira,
      intentos: 0
    };

    // Enviar código por correo
    const resultadoEmail = await enviarCodigoRegistro(email, 'Usuario', codigo);
    
    if (!resultadoEmail.success) {
      console.error('Error al enviar código:', resultadoEmail.error);
      return res.status(500).json({ error: 'Error al enviar el código de verificación' });
    }

    res.json({
      mensaje: 'Código de verificación enviado a tu correo',
      email,
      emailEnviado: resultadoEmail.success
    });
  } catch (error) {
    console.error('Error al solicitar código:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// Paso 2: Verificar código y completar registro
router.post('/verificar-codigo-registro', async (req, res) => {
  try {
    const { email, codigo, nombres, apellidos, password, confirmarPassword, dni, telefono, rol } = req.body;

    // Validaciones
    if (!email || !codigo || !nombres || !apellidos || !password || !confirmarPassword || !dni) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Validar que las contraseñas coincidan
    if (password !== confirmarPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    // Validar contraseña segura (mínimo 8 caracteres, debe incluir números y letras)
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe incluir al menos un número' });
    }

    if (!/[a-zA-Z]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe incluir al menos una letra' });
    }

    // Verificar código
    const codigoPendiente = global.codigosRegistroPendientes?.[email];
    
    if (!codigoPendiente) {
      return res.status(400).json({ error: 'No se encontró un código para este correo. Solicita uno nuevo.' });
    }

    if (new Date() > codigoPendiente.expira) {
      delete global.codigosRegistroPendientes[email];
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    if (codigoPendiente.intentos >= 3) {
      delete global.codigosRegistroPendientes[email];
      return res.status(400).json({ error: 'Demasiados intentos fallidos. Solicita un nuevo código.' });
    }

    if (codigoPendiente.codigo !== codigo) {
      codigoPendiente.intentos++;
      return res.status(400).json({ 
        error: 'Código incorrecto',
        intentosRestantes: 3 - codigoPendiente.intentos
      });
    }

    // Verificar nuevamente si el usuario ya existe (por si acaso)
    const usuarioExistente = await Usuario.findOne({ $or: [{ email }, { dni }] });
    if (usuarioExistente) {
      delete global.codigosRegistroPendientes[email];
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Crear nuevo usuario (ya verificado)
    const usuario = new Usuario({
      nombres,
      apellidos,
      email,
      password,
      dni,
      telefono,
      rol: rol || 'SOLICITANTE',
      emailVerificado: true // Ya verificado con código
    });

    await usuario.save();

    // Limpiar código usado
    delete global.codigosRegistroPendientes[email];

    res.status(201).json({
      mensaje: 'Registro completado exitosamente. Ya puedes iniciar sesión.'
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Verificar email
router.get('/verificar-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Buscar usuario con el token
    const usuario = await Usuario.findOne({
      tokenVerificacion: token,
      tokenVerificacionExpira: { $gt: Date.now() }
    });

    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Verificar el email
    usuario.emailVerificado = true;
    usuario.tokenVerificacion = undefined;
    usuario.tokenVerificacionExpira = undefined;
    await usuario.save();

    res.json({ 
      mensaje: '¡Email verificado exitosamente! Ya puedes iniciar sesión.',
      email: usuario.email
    });
  } catch (error) {
    console.error('Error al verificar email:', error);
    res.status(500).json({ error: 'Error al verificar email' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar password
    const passwordValido = await usuario.compararPassword(password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar si el email está verificado
    if (!usuario.emailVerificado) {
      return res.status(403).json({ 
        error: 'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.' 
      });
    }

    // Verificar si está activo
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    // Actualizar último acceso
    usuario.ultimoAcceso = Date.now();
    await usuario.save();

    // Generar token
    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      usuario: {
        id: usuario._id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Verificar token
router.get('/verificar', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select('-password');
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ usuario });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// Paso 1: Solicitar código para cambio de contraseña
router.post('/solicitar-codigo-cambio-contrasena', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar código numérico de 6 dígitos
    const codigo = generarCodigoNumerico();
    const codigoExpira = new Date();
    codigoExpira.setMinutes(codigoExpira.getMinutes() + 10); // Expira en 10 minutos

    // Guardar código en el usuario
    usuario.codigoCambioContrasena = codigo;
    usuario.codigoCambioContrasenaExpira = codigoExpira;
    await usuario.save();

    // Enviar código por correo
    const resultadoEmail = await enviarCodigoCambioContrasena(usuario, codigo);
    
    if (!resultadoEmail.success) {
      console.error('Error al enviar código:', resultadoEmail.error);
    }

    res.json({
      mensaje: 'Código de verificación enviado a tu correo',
      email: usuario.email,
      emailEnviado: resultadoEmail.success
    });
  } catch (error) {
    console.error('Error al solicitar código:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// Paso 2: Verificar código y cambiar contraseña
router.put('/cambiar-contrasena', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { codigo, contrasenaNueva, confirmarContrasena } = req.body;

    if (!codigo || !contrasenaNueva || !confirmarContrasena) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Validar que las contraseñas coincidan
    if (contrasenaNueva !== confirmarContrasena) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    // Validar contraseña segura (mínimo 8 caracteres, debe incluir números y letras)
    if (contrasenaNueva.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/[0-9]/.test(contrasenaNueva)) {
      return res.status(400).json({ error: 'La contraseña debe incluir al menos un número' });
    }

    if (!/[a-zA-Z]/.test(contrasenaNueva)) {
      return res.status(400).json({ error: 'La contraseña debe incluir al menos una letra' });
    }

    // Buscar usuario
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar código
    if (!usuario.codigoCambioContrasena) {
      return res.status(400).json({ error: 'No se ha solicitado un código. Por favor solicita uno primero.' });
    }

    if (new Date() > usuario.codigoCambioContrasenaExpira) {
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    if (usuario.codigoCambioContrasena !== codigo) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    // Actualizar contraseña
    usuario.password = contrasenaNueva;
    usuario.codigoCambioContrasena = undefined;
    usuario.codigoCambioContrasenaExpira = undefined;
    await usuario.save();

    res.json({ mensaje: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

module.exports = router;
