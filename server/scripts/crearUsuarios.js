const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Usuario = require('../models/Usuario');

// Cargar variables de entorno
dotenv.config({ path: '../.env' });

// Usuarios a crear
const usuarios = [
  {
    nombres: 'Admin',
    apellidos: 'Sistema',
    email: 'admin@sistema.com',
    password: 'admin123sis45temaFIS',
    dni: '12345678',
    telefono: '987654321',
    rol: 'ADMINISTRADOR'
  },
  {
    nombres: 'Juan',
    apellidos: 'Usuario',
    email: 'usuario@sistema.com',
    password: 'usuario123',
    dni: '87654321',
    telefono: '912345678',
    rol: 'SOLICITANTE'
  }
];

async function crearUsuarios() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/licencias_construccion', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Conectado a MongoDB');

    // Crear usuarios
    for (const userData of usuarios) {
      // Verificar si el usuario ya existe
      const existente = await Usuario.findOne({ email: userData.email });
      
      if (existente) {
        console.log(`⚠ Usuario ${userData.email} ya existe, actualizando...`);
        
        // Actualizar el usuario existente
        existente.nombres = userData.nombres;
        existente.apellidos = userData.apellidos;
        existente.dni = userData.dni;
        existente.telefono = userData.telefono;
        existente.rol = userData.rol;
        existente.password = userData.password; // Se hasheará automáticamente
        existente.activo = true;
        
        await existente.save();
        console.log(`✓ Usuario ${userData.email} actualizado`);
      } else {
        // Crear nuevo usuario
        const usuario = new Usuario(userData);
        await usuario.save();
        console.log(`✓ Usuario ${userData.email} creado exitosamente`);
      }
    }

    console.log('\n=== USUARIOS CREADOS/ACTUALIZADOS ===');
    console.log('\n👤 ADMINISTRADOR:');
    console.log('   Email: admin@sistema.com');
    console.log('   Password: admin123sis45temaFIS');
    console.log('   Rol: ADMINISTRADOR');
    
    console.log('\n👤 USUARIO:');
    console.log('   Email: usuario@sistema.com');
    console.log('   Password: usuario123');
    console.log('   Rol: SOLICITANTE');
    
    console.log('\n✓ ¡Listo! Ahora puedes iniciar sesión en http://localhost:3000');

  } catch (error) {
    console.error('❌ Error al crear usuarios:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Desconectado de MongoDB');
    process.exit();
  }
}

// Ejecutar
crearUsuarios();
