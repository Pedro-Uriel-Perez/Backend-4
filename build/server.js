"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promise_1 = __importDefault(require("mysql2/promise"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const express_session_1 = __importDefault(require("express-session"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const passport_twitter_1 = require("passport-twitter");
const paypal = __importStar(require("@paypal/checkout-server-sdk"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Configuración de CORS
app.use((0, cors_1.default)({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
// Configuración de sesión
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'GYWEBFEK98EWJBKUEG73BFKJWskasasa',
    resave: false,
    saveUninitialized: false
}));
// Inicialización de Passport
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Conexiones a la base de datos
const pool = promise_1.default.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    connectionLimit: 10
});
// Configuración de PayPal
const PAYPAL_CLIENT_ID = 'AUJbTRPDtHgHEMJ4Dvt6Rc9wTyfB2pWWxc1KYz3EiwdgwcZDoS5JPi2L_UmrtjmYL5K9OBnei_Mo9365';
const PAYPAL_CLIENT_SECRET = 'ELnZHD9kkgGbdOpv3lsYYOxLg7dejIG4sOiwYnBW0aTuTuPQHKFFJya92qLyV0nOFlGDspVkl60S06S9';
const environment = new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
const client = new paypal.core.PayPalHttpClient(environment);
app.post('/api/pagos', async (req, res) => {
    try {
        const { numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital, fechaPago } = req.body;
        const [result] = await pool.execute('INSERT INTO pagos (numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital, fechaPago) VALUES (?, ?, ?, ?, ?, ?, ?)', [numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital, fechaPago]);
        // @ts-ignore
        res.json({ message: 'Pago procesado con éxito', idPago: result.insertId });
    }
    catch (error) {
        console.error('Error al procesar el pago:', error);
        res.status(500).json({ message: 'Error al procesar el pago' });
    }
});
app.post('/api/pagos-paypal', async (req, res) => {
    try {
        console.log('Datos recibidos:', req.body);
        const { idHospital, monto, detallesPago } = req.body;
        if (!detallesPago || !detallesPago.id || !idHospital || !monto) {
            return res.status(400).json({ message: 'Faltan datos requeridos' });
        }
        const request = new paypal.orders.OrdersCaptureRequest(detallesPago.id);
        console.log('Ejecutando solicitud a PayPal');
        const response = await client.execute(request);
        console.log('Respuesta de PayPal:', JSON.stringify(response, null, 2));
        if (response.result.status !== 'COMPLETED') {
            return res.status(400).json({ message: 'La transacción de PayPal no fue completada' });
        }
        const montoPagado = response.result.purchase_units[0].payments.captures[0].amount.value;
        console.log('Insertando en la base de datos');
        const [result] = await pool.execute('INSERT INTO pagos (numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital, fechaPago) VALUES (?, ?, ?, ?, ?, ?, ?)', ['PayPal', detallesPago.payer.name.given_name + ' ' + detallesPago.payer.name.surname, 'N/A', 'N/A', montoPagado, idHospital, new Date()]);
        console.log('Resultado de la inserción:', result);
        res.json({
            message: 'Pago de PayPal procesado con éxito',
            transactionID: response.result.id,
            idPago: result.insertId
        });
    }
    catch (error) {
        console.error('Error detallado:', error);
        let errorMessage = 'Error desconocido al procesar el pago de PayPal';
        if (error instanceof Error) {
            errorMessage = error.message;
            console.error('Stack trace:', error.stack);
        }
        if (error) {
            console.error('Respuesta de error de PayPal:', error.response);
        }
        res.status(500).json({ message: 'Error al procesar el pago de PayPal', error: errorMessage });
    }
});
app.post('/api/hospitales', async (req, res) => {
    try {
        const { nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto } = req.body;
        if (!nombreHospital || !direccion || !estado || !municipio || !telefono || !nomRepresHospital || !rfcHospital || !monto) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        const [result] = await pool.query('INSERT INTO hospital (nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto]);
        // @ts-ignore
        res.status(201).json({ message: 'Hospital registrado con éxito', idHospital: result.insertId });
    }
    catch (error) {
        console.error('Error al guardar el hospital:', error);
        res.status(500).json({ message: 'Error al guardar el hospital' });
    }
});
// Configuración de la estrategia de Twitter
passport_1.default.use(new passport_twitter_1.Strategy({
    consumerKey: process.env.TWITTER_API_KEY,
    consumerSecret: process.env.TWITTER_API_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL || "http://localhost:3000/api/auth/twitter/callback",
    includeEmail: true // Para obtener el correo del usuario, si está disponible
}, async function (token, tokenSecret, profile, done) {
    try {
        console.log('Profile from Twitter:', JSON.stringify(profile, null, 2));
        let email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@twitter.com`;
        let name = profile.displayName || profile.username || 'Usuario de Twitter';
        // Lógica para encontrar o crear el usuario en la base de datos
        const [rows] = await pool.execute('SELECT * FROM usuarios WHERE twitter_id = ?', [profile.id]);
        if (rows.length > 0) {
            console.log('Existing user found:', rows[0]);
            await pool.execute('UPDATE usuarios SET nombre = ?, correo = ? WHERE twitter_id = ?', [name, email, profile.id]);
            done(null, rows[0]);
        }
        else {
            console.log('Creating new user');
            const [result] = await pool.execute('INSERT INTO usuarios (nombre, apePaterno, apeMaterno, correo, twitter_id) VALUES (?, ?, ?, ?, ?)', [name, '', '', email, profile.id]);
            const [newUser] = await pool.execute('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);
            console.log('New user created:', newUser[0]);
            done(null, newUser[0]);
        }
    }
    catch (error) {
        console.error('Error in Twitter strategy:', error);
        done(error);
    }
}));
// Rutas de autenticación para Twitter
app.get('/api/auth/twitter', passport_1.default.authenticate('twitter'));
app.get('/api/auth/twitter/callback', passport_1.default.authenticate('twitter', { failureRedirect: '/login' }), function (req, res) {
    const user = req.user; // Aquí obtienes el usuario autenticado
    // Asegúrate de que el usuario no sea undefined
    if (!user) {
        console.error("User is undefined");
        return res.redirect('/login'); // Redirige en caso de error
    }
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        twitter_id: user.twitter_id
    }, process.env.JWT_SECRET || 'tu_secreto_jwt', { expiresIn: '1h' });
    // Redirige con el token
    res.redirect(`http://localhost:4200/auth-callback?token=${token}`);
});
// Ruta para verificar si el usuario de Twitter existe
app.get('/is-twitter-user', async (req, res) => {
    const twitterId = req.query.twitter_id;
    if (!twitterId) {
        return res.status(400).json({ message: 'Twitter ID is required' });
    }
    try {
        const query = 'SELECT * FROM users WHERE twitter_id = ?';
        const [rows] = await pool.query(query, [twitterId]);
        if (Array.isArray(rows) && rows.length > 0) {
            const user = rows[0];
            res.json({
                message: 'Twitter user found',
                user: {
                    id: user.id,
                    nombre: user.nombre,
                    twitter_id: user.twitter_id
                }
            });
        }
        else {
            res.status(404).json({ message: 'Twitter user not found' });
        }
    }
    catch (error) {
        console.error('Error fetching Twitter user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Configuración de la estrategia de GitHub
passport_1.default.use(new passport_github2_1.Strategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/api/auth/github/callback"
}, async function (accessToken, refreshToken, profile, done) {
    try {
        console.log('Profile from GitHub:', JSON.stringify(profile, null, 2));
        let email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@github.com`;
        let name = profile.displayName || profile.username || 'Usuario de GitHub';
        const [rows] = await pool.execute('SELECT * FROM usuarios WHERE github_id = ?', [profile.id]);
        if (rows.length > 0) {
            console.log('Existing user found:', rows[0]);
            await pool.execute('UPDATE usuarios SET nombre = ?, correo = ? WHERE github_id = ?', [name, email, profile.id]);
            done(null, rows[0]);
        }
        else {
            console.log('Creating new user');
            const [result] = await pool.execute('INSERT INTO usuarios (nombre, apePaterno, apeMaterno, correo, github_id) VALUES (?, ?, ?, ?, ?)', [name, '', '', email, profile.id]);
            const [newUser] = await pool.execute('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);
            console.log('New user created:', newUser[0]);
            done(null, newUser[0]);
        }
    }
    catch (error) {
        console.error('Error in GitHub strategy:', error);
        done(error);
    }
}));
app.get('/api/auth/github', passport_1.default.authenticate('github', { scope: ['user:email'] }));
app.get('/api/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/login' }), function (req, res) {
    try {
        const user = req.user;
        if (!user) {
            console.error('No user data after GitHub authentication');
            return res.redirect('/login?error=authentication_failed');
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            nombre: user.nombre,
            correo: user.correo,
            github_id: user.github_id
        }, process.env.JWT_SECRET || 'tu_secreto_jwt', { expiresIn: '1h' });
        // Codifica el nombre de usuario para la URL
        const encodedUserName = encodeURIComponent(user.nombre);
        // Redirige a la página de citas con userId y userName
        res.redirect(`http://localhost:4200/citas;userId=${user.id};userName=${encodedUserName}?token=${token}`);
    }
    catch (error) {
        console.error('Error in GitHub callback:', error);
        res.redirect('/login?error=internal_server_error');
    }
});
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM usuarios WHERE id = ?', [id]);
        done(null, rows[0]);
    }
    catch (error) {
        done(error);
    }
});
// Ruta de autenticación de GitHub
app.get('/api/auth/github', passport_1.default.authenticate('github', { scope: ['user:email'] }));
app.get('/api/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/login' }), function (req, res) {
    const user = req.user;
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        github_id: user.github_id
    }, process.env.JWT_SECRET || 'tu_secreto_jwt', { expiresIn: '1h' });
    res.redirect(`http://localhost:4200/auth-callback?token=${token}`);
});
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.execute('SELECT id, nombre, correo, twitter_id FROM usuarios WHERE id = ?', [userId]);
        if (rows.length > 0) {
            res.json(rows[0]);
        }
        else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al obtener información del usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// Middleware para autenticar token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null)
        return res.sendStatus(401);
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'tu_secreto_jwt', (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        next();
    });
}
// Verificación de token
app.post('/api/verify-token', (req, res) => {
    const { token } = req.body;
    console.log('Verificando token:', token);
    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default_secret');
        console.log('Token verificado exitosamente');
        res.json({ valid: true, decoded });
    }
    catch (error) {
        console.error('Error al verificar el token:', error);
        res.status(401).json({ valid: false, message: 'Invalid or expired token' });
    }
});
// Ejemplo de ruta para verificar el funcionamiento de la API
app.get('/', (_req, res) => {
    res.send('API de Citas Médicas funcionando correctamente ahora!!!');
});
// Ruta de registro
app.post('/api/register', async (req, res) => {
    try {
        const { nombre, apePaterno, apeMaterno, correo, contrase, edad, tipoSangre, genero } = req.body;
        console.log('Datos de registro recibidos:', { nombre, apePaterno, apeMaterno, correo, edad, tipoSangre, genero });
        // Validación de campos obligatorios
        if (!nombre || !apePaterno || !apeMaterno || !correo || !contrase || !tipoSangre || !genero) {
            console.log('Error: Campos incompletos');
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        // Validación de formato de correo electrónico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
            console.log('Error: Formato de correo inválido');
            return res.status(400).json({ error: 'Formato de correo electrónico inválido' });
        }
        // Verificar si el correo ya está registrado
        console.log('Verificando si el correo ya existe...');
        const [existingUsers] = await pool.execute('SELECT id FROM usuarios WHERE correo = ?', [correo]);
        if (existingUsers.length > 0) {
            console.log('Error: Correo ya registrado');
            return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
        }
        console.log('Hasheando contraseña...');
        const hashedPassword = await bcrypt_1.default.hash(contrase, 10);
        // Preparar la consulta SQL y los valores
        let sql = 'INSERT INTO usuarios (nombre, apePaterno, apeMaterno, correo, contrase';
        const values = [nombre, apePaterno, apeMaterno, correo, hashedPassword];
        // Añadir campos opcionales si están presentes
        if (edad !== undefined) {
            sql += ', edad';
            values.push(edad);
        }
        if (tipoSangre !== undefined) {
            sql += ', tipoSangre';
            values.push(tipoSangre);
        }
        if (genero !== undefined) {
            sql += ', genero';
            values.push(genero);
        }
        sql += ') VALUES (' + '?,'.repeat(values.length).slice(0, -1) + ')';
        console.log('Ejecutando consulta SQL:', sql);
        console.log('Valores:', values);
        // Insertar nuevo usuario
        const [result] = await pool.execute(sql, values);
        if (result.insertId) {
            console.log('Usuario registrado exitosamente:', result.insertId);
            return res.status(201).json({
                message: 'Usuario registrado exitosamente',
                id: result.insertId,
                usuario: { nombre, apePaterno, apeMaterno, correo, edad, tipoSangre, genero }
            });
        }
        else {
            throw new Error('No se pudo insertar el usuario');
        }
    }
    catch (error) {
        console.error('Error detallado en el registro:', error);
        if (error instanceof Error) {
            console.error('Mensaje de error:', error.message);
            console.error('Stack trace:', error.stack);
        }
        if (error instanceof Error && 'code' in error) {
            const mysqlError = error;
            switch (mysqlError.code) {
                case 'ER_DUP_ENTRY':
                    return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
                case 'ER_ACCESS_DENIED_ERROR':
                    console.error('Error de acceso a la base de datos');
                    break;
                default:
                    console.error('Código de error MySQL:', mysqlError.code);
            }
        }
        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Ruta para obtener todos los usuarios o un usuario específico
app.get('/api/usuarios/:id?', async (req, res) => {
    try {
        const { id } = req.params;
        if (id) {
            // Obtener un usuario específico por ID
            const [rows] = await pool.execute('SELECT id, nombre, apePaterno, apeMaterno, correo FROM usuarios WHERE id = ?', [id]);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            return res.json(rows[0]);
        }
        else {
            // Obtener todos los usuarios
            const [rows] = await pool.execute('SELECT id, nombre, apePaterno, apeMaterno, correo FROM usuarios');
            console.log('Usuarios obtenidos:', rows.length);
            return res.json(rows);
        }
    }
    catch (error) {
        console.error('Error al obtener usuario(s):', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta de login
app.post('/api/login', async (req, res) => {
    try {
        const { correo, contrase } = req.body;
        const [rows] = await pool.execute('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        if (rows.length > 0) {
            const user = rows[0];
            const isMatch = await bcrypt_1.default.compare(contrase, user.contrase);
            await pool.execute('INSERT INTO login_attempts (usuario_id, exitoso) VALUES (?, ?)', [user.id, isMatch]);
            if (isMatch) {
                res.json({
                    isAuthenticated: true,
                    userId: user.id.toString(),
                    userName: user.nombre
                });
            }
            else {
                res.json({ isAuthenticated: false });
            }
        }
        else {
            await pool.execute('INSERT INTO login_attempts (usuario_id, exitoso) VALUES (?, ?)', [null, false]);
            res.json({ isAuthenticated: false });
        }
    }
    catch (error) {
        console.error('Error en la autenticación:', error);
        res.status(500).json({ error: 'Error en la autenticación' });
    }
});
// Ruta para registrar una nueva cita
app.post('/api/citas', async (req, res) => {
    try {
        const { IdMedico, idPaciente, nombrePaciente, descripcion, fecha, hora } = req.body;
        const [result] = await pool.execute('INSERT INTO citas (IdMedico, idPaciente, nombrePaciente, descripcion, fecha, hora) VALUES (?, ?, ?, ?, ?, ?)', [IdMedico, idPaciente, nombrePaciente, descripcion, fecha, hora]);
        if (result.insertId) {
            console.log('Cita registrada exitosamente:', result);
            return res.status(201).json({ message: 'Cita registrada exitosamente', id: result.insertId });
        }
        else {
            console.error('Error al registrar cita:', result);
            return res.status(500).json({ error: 'Error al registrar cita' });
        }
    }
    catch (error) {
        console.error('Error al registrar cita:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta para obtener las citas de un paciente
app.get('/api/citas/:idPaciente', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT c.*, m.nombre as nombreMedico, m.especialidad, m.hospital, m.telefono as telefonoMedico, m.correo as correoMedico 
       FROM citas c 
       LEFT JOIN medicos m ON c.IdMedico = m.id 
       WHERE c.idPaciente = ? 
       ORDER BY c.fecha DESC, c.hora DESC`, [req.params.idPaciente]);
        console.log('Citas encontradas:', rows);
        res.json(rows);
    }
    catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ error: 'Error al obtener citas' });
    }
});
// Ruta para obtener una cita específica por su ID
app.get('/api/citas/idcita/:idCita', async (req, res) => {
    try {
        const idCita = req.params.idCita;
        const [rows] = await pool.execute(`SELECT c.*, m.nombre as nombreMedico, m.especialidad, m.hospital, m.telefono as telefonoMedico, m.correo as correoMedico
       FROM citas c 
       LEFT JOIN medicos m ON c.IdMedico = m.id 
       LEFT JOIN usuarios p ON c.idPaciente = p.id
       WHERE c.idcita = ?`, [idCita]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        return res.json(rows[0]);
    }
    catch (error) {
        console.error('Error al obtener la cita:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta de prueba para obtener citas
app.get('/api/test-citas/:idPaciente', async (req, res) => {
    try {
        const idPaciente = req.params.idPaciente;
        const [rows] = await pool.execute('SELECT * FROM citas WHERE idPaciente = ?', [idPaciente]);
        res.json({
            message: 'Consulta de prueba',
            idPaciente: idPaciente,
            citasCount: rows.length,
            citas: rows
        });
    }
    catch (error) {
        console.error('Error en la consulta de prueba:', error);
        res.status(500).json({ error: 'Error en la consulta de prueba' });
    }
});
// Ruta para modificar una cita existente
app.put('/api/citas/:idCita', async (req, res) => {
    try {
        const idCita = req.params.idCita;
        const { fecha, hora, nombrePaciente, descripcion } = req.body;
        console.log('Actualizando cita:', { idCita, fecha, hora, nombrePaciente, descripcion }); // Log para depuración
        const [result] = await pool.execute('UPDATE citas SET fecha = ?, hora = ?, nombrePaciente = ?,descripcion = ? WHERE idcita = ?', [fecha, hora, nombrePaciente, descripcion, idCita]);
        if (result.affectedRows > 0) {
            console.log('Cita actualizada exitosamente');
            res.json({ message: 'Cita actualizada exitosamente' });
        }
        else {
            console.log('Cita no encontrada');
            res.status(404).json({ error: 'Cita no encontrada' });
        }
    }
    catch (error) {
        console.error('Error al actualizar la cita:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta para cancelar (eliminar) una cita
app.delete('/api/citas/:idCita', async (req, res) => {
    try {
        const idCita = req.params.idCita;
        const [result] = await pool.execute('DELETE FROM citas WHERE idcita = ?', [idCita]);
        if (result.affectedRows > 0) {
            res.json({ message: 'Cita cancelada exitosamente' });
        }
        else {
            res.status(404).json({ error: 'Cita no encontrada' });
        }
    }
    catch (error) {
        console.error('Error al cancelar la cita:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
//Ruta para unicio de sesion de medixos
// ...
app.post('/api/medico-login', async (req, res) => {
    try {
        const { correo, id } = req.body;
        const [rows] = await pool.execute('SELECT * FROM medicos WHERE correo = ? AND id = ?', [correo, id]);
        if (rows.length > 0) {
            const medico = rows[0];
            res.json({
                isAuthenticated: true,
                medicoId: medico.id,
                medicoNombre: medico.nombre,
                medicoApellido: medico.apellido,
                especialidad: medico.especialidad,
                hospital: medico.hospital
            });
        }
        else {
            res.json({ isAuthenticated: false });
        }
    }
    catch (error) {
        console.error('Error en la autenticación del médico:', error);
        res.status(500).json({ error: 'Error en la autenticación' });
    }
});
// Ruta para obtener las citas del médico
app.get('/api/citas-medico/:medicoId', async (req, res) => {
    try {
        const medicoId = req.params.medicoId;
        const [rows] = await pool.execute(`
      SELECT c.*, 
             u.nombre, u.apePaterno, u.apeMaterno, u.edad, u.tipoSangre, u.genero,
             DATE_FORMAT(c.fecha, '%d/%m/%Y') as fechaFormateada,
             TIME_FORMAT(c.hora, '%H:%i') as horaFormateada
      FROM citas c 
      JOIN usuarios u ON c.idPaciente = u.id 
      WHERE c.IdMedico = ? 
      ORDER BY c.fecha ASC, c.hora ASC`, [medicoId]);
        console.log('Datos crudos de citas:', rows);
        const citasFormateadas = rows.map(cita => ({
            idcita: cita.idcita,
            IdMedico: cita.IdMedico,
            idPaciente: cita.idPaciente.toString(),
            nombrePaciente: `${cita.nombre || ''} ${cita.apePaterno || ''} ${cita.apeMaterno || ''}`.trim(),
            descripcion: cita.descripcion,
            fecha: cita.fecha,
            hora: cita.hora,
            estado: cita.estado,
            fechaFormateada: cita.fechaFormateada,
            horaFormateada: cita.horaFormateada,
            paciente: {
                id: cita.idPaciente,
                nombre: `${cita.nombre || ''} ${cita.apePaterno || ''} ${cita.apeMaterno || ''}`.trim(),
                edad: cita.edad,
                tipoSangre: cita.tipoSangre,
                genero: cita.genero
            },
            esPasada: new Date(cita.fecha) < new Date(),
            tieneHistorial: cita.estado === 'finalizada',
            puedeModificar: cita.estado === 'pendiente',
            estaFinalizada: cita.estado === 'finalizada'
        }));
        console.log('Citas formateadas:', citasFormateadas);
        res.json(citasFormateadas);
    }
    catch (error) {
        console.error('Error al obtener citas del médico:', error);
        res.status(500).json({ error: 'Error al obtener citas del médico' });
    }
});
// Confirmar cita porr parte del medicoo
app.put('/api/citas/:idCita/confirmar', async (req, res) => {
    try {
        const idCita = req.params.idCita;
        const [result] = await pool.execute('UPDATE citas SET estado = "confirmada" WHERE idcita = ?', [idCita]);
        if (result.affectedRows > 0) {
            res.json({ message: 'Cita confirmada exitosamente' });
        }
        else {
            res.status(404).json({ error: 'Cita no encontrada' });
        }
    }
    catch (error) {
        console.error('Error al confirmar la cita:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
//Guardar, cambiando a cancelada solamnete
app.put('/api/citas/:idCita/cancelar', async (req, res) => {
    try {
        const idCita = req.params.idCita;
        const [result] = await pool.execute('UPDATE citas SET estado = "cancelada" WHERE idcita = ?', [idCita]);
        if (result.affectedRows > 0) {
            res.json({ message: 'Cita cancelada exitosamente' });
        }
        else {
            res.status(404).json({ error: 'Cita no encontrada' });
        }
    }
    catch (error) {
        console.error('Error al cancelar la cita:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Finalizar cita y agregar historial médico
app.post('/api/citas/:idCita/finalizar', async (req, res) => {
    try {
        const idCita = req.params.idCita;
        const { diagnostico, tratamiento, observaciones } = req.body;
        console.log('Datos recibidos:', { idCita, diagnostico, tratamiento, observaciones });
        // Actualizar estado de la cita
        await pool.execute('UPDATE citas SET estado = "finalizada" WHERE idcita = ?', [idCita]);
        // Obtener información de la cita
        const [citaRows] = await pool.execute('SELECT c.*, u.edad, u.tipoSangre FROM citas c JOIN usuarios u ON c.idPaciente = u.id WHERE c.idcita = ?', [idCita]);
        if (citaRows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        const cita = citaRows[0];
        // Insertar historial médico
        await pool.execute(`
      INSERT INTO historial_medico 
      (id_paciente, id_medico, id_cita, fecha, diagnostico, tratamiento, observaciones, edad_paciente, tipo_sangre_paciente)
      VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?)`, [
            cita.idPaciente,
            cita.IdMedico,
            idCita,
            diagnostico || null,
            tratamiento || null,
            observaciones || null,
            cita.edad || null,
            cita.tipoSangre || null
        ]);
        res.json({ message: 'Cita finalizada y historial médico registrado' });
    }
    catch (error) {
        console.error('Error al finalizar la cita:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Obtener historial médico de un paciente
app.get('/api/historial-medico/:idPaciente', async (req, res) => {
    try {
        const idPaciente = req.params.idPaciente;
        console.log('Solicitando historial médico para el paciente:', idPaciente);
        const [rows] = await pool.execute(`
      SELECT hm.*, 
             c.fecha as fecha_cita, c.hora as hora_cita,
             m.nombre as nombreMedico, m.apellido as apellidoMedico, m.especialidad,
             u.nombre as nombrePaciente, u.apePaterno, u.apeMaterno, 
             COALESCE(hm.edad_paciente, u.edad) as edad_paciente,
             COALESCE(hm.tipo_sangre_paciente, u.tipoSangre) as tipo_sangre_paciente
      FROM historial_medico hm
      JOIN citas c ON hm.id_cita = c.idcita
      JOIN medicos m ON hm.id_medico = m.id
      JOIN usuarios u ON hm.id_paciente = u.id
      WHERE hm.id_paciente = ?
      ORDER BY c.fecha DESC, c.hora DESC`, [idPaciente]);
        console.log('Registros encontrados:', rows.length);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No se encontró historial médico para este paciente' });
        }
        const historialFormateado = rows.map(registro => ({
            ...registro,
            nombreMedicoCompleto: `${registro.nombreMedico || ''} ${registro.apellidoMedico || ''}`.trim(),
            nombrePacienteCompleto: `${registro.nombrePaciente || ''} ${registro.apePaterno || ''} ${registro.apeMaterno || ''}`.trim(),
            fechaFormateada: new Date(registro.fecha_cita).toLocaleDateString(),
            horaFormateada: new Date(`2000-01-01T${registro.hora_cita}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        console.log('Historial formateado:', historialFormateado);
        res.json(historialFormateado);
    }
    catch (error) {
        console.error('Error al obtener el historial médico:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Modificar historial médico
app.put('/api/historial-medico/:idRegistro', async (req, res) => {
    try {
        const idRegistro = req.params.idRegistro;
        const { diagnostico, tratamiento, observaciones } = req.body;
        console.log('Actualizando registro con ID:', idRegistro);
        const [result] = await pool.execute(`
      UPDATE historial_medico 
      SET diagnostico = ?, tratamiento = ?, observaciones = ? 
      WHERE id = ?`, [diagnostico, tratamiento, observaciones, idRegistro]);
        // Verificar si se actualizó algún registro
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'No se encontró el registro para actualizar' });
        }
        res.json({ message: 'Registro actualizado correctamente' });
    }
    catch (error) {
        console.error('Error al actualizar el historial médico:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Eliminar registro del historial médico
app.delete('/api/historial-medico/:idRegistro', async (req, res) => {
    try {
        const idRegistro = req.params.idRegistro;
        console.log('Eliminando registro con ID:', idRegistro);
        const [result] = await pool.execute(`
      DELETE FROM historial_medico WHERE id = ?`, [idRegistro]);
        // Verificar si se eliminó algún registro
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'No se encontró el registro para eliminar' });
        }
        res.json({ message: 'Registro eliminado correctamente' });
    }
    catch (error) {
        console.error('Error al eliminar el historial médico:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta para procesar y guardar el pago
app.post('/api/registrar-pagos', async (req, res) => {
    try {
        const { numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital } = req.body;
        // Validar datos del pago
        if (!numeroTarjeta || !nombreTitular || !fechaExpiracion || !codigoSeguridad || !monto || !idHospital) {
            return res.status(400).json({ error: 'Datos de pago incompletos' });
        }
        const [result] = await pool.execute('INSERT INTO pagos (numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital) VALUES (?, ?, ?, ?, ?, ?)', [numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital]);
        if (result.insertId) {
            return res.status(201).json({ message: 'Pago registrado exitosamente', idPago: result.insertId });
        }
        else {
            return res.status(500).json({ error: 'Error al registrar el pago' });
        }
    }
    catch (error) {
        console.error('Error al procesar el pago:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta para obtener todos los pagos
// Ruta para obtener un pago por su ID
app.get('/api/pagos/:idPago', async (req, res) => {
    try {
        const { idPago } = req.params;
        const [rows] = await pool.execute('SELECT * FROM pagos WHERE idPago = ?', [idPago]);
        if (rows.length > 0) {
            return res.status(200).json(rows[0]);
        }
        else {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al obtener el pago:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta para actualizar un pago por su ID
app.put('/api/pagos/:idPago', async (req, res) => {
    try {
        const { idPago } = req.params;
        const { numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto } = req.body;
        // Validar datos del pago
        if (!numeroTarjeta || !nombreTitular || !fechaExpiracion || !codigoSeguridad || !monto) {
            return res.status(400).json({ error: 'Datos de pago incompletos' });
        }
        const [result] = await pool.execute('UPDATE pagos SET numeroTarjeta = ?, nombreTitular = ?, fechaExpiracion = ?, codigoSeguridad = ?, monto = ? WHERE idPago = ?', [numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idPago]);
        if (result.affectedRows > 0) {
            return res.status(200).json({ message: 'Pago actualizado exitosamente' });
        }
        else {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al actualizar el pago:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Ruta para eliminar un pago por su ID
app.delete('/api/pagos/:idPago', async (req, res) => {
    try {
        const { idPago } = req.params;
        const [result] = await pool.execute('DELETE FROM pagos WHERE idPago = ?', [idPago]);
        if (result.affectedRows > 0) {
            return res.status(200).json({ message: 'Pago eliminado exitosamente' });
        }
        else {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al eliminar el pago:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
//------------------------------------------
// Rutas para hospitales
app.post('/api/registrar-hospital', async (req, res) => {
    try {
        const { nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto } = req.body;
        if (!nombreHospital || !direccion || !estado || !municipio ||
            !numSucursal || !telefono || !nomRepresHospital ||
            !rfcHospital || monto === undefined) {
            return res.status(400).json({ error: 'Datos del hospital incompletos' });
        }
        const [result] = await pool.query('INSERT INTO hospital (nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto]);
        if (result.insertId) {
            return res.status(201).json({
                message: 'Hospital registrado exitosamente',
                idHospital: result.insertId
            });
        }
        else {
            return res.status(500).json({ error: 'Error al registrar el hospital' });
        }
    }
    catch (error) {
        console.error('Error al procesar el registro del hospital:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Obtener un hospital por ID
app.get('/api/hospital/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM hospital WHERE idHospital = ?', [id]);
        if (rows.length > 0) {
            return res.json(rows[0]);
        }
        else {
            return res.status(404).json({ error: 'Hospital no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al obtener el hospital:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Actualizar un hospital por ID
app.put('/api/hospital/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto } = req.body;
        if (!nombreHospital || !direccion || !estado || !municipio || !numSucursal || !telefono || !nomRepresHospital || !rfcHospital || !monto) {
            return res.status(400).json({ error: 'Datos incompletos para actualizar el hospital' });
        }
        const [result] = await pool.query(`UPDATE hospital SET nombreHospital = ?, direccion = ?, estado = ?, municipio = ?, numSucursal = ?, telefono = ?, nomRepresHospital = ?, rfcHospital = ?, monto = ? WHERE idHospital = ?`, [nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto, id]);
        if (result.affectedRows > 0) {
            return res.json({ message: 'Hospital actualizado exitosamente' });
        }
        else {
            return res.status(404).json({ error: 'Hospital no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al actualizar el hospital:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Eliminar un hospital por ID
app.delete('/api/hospital/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM hospital WHERE idHospital = ?', [id]);
        if (result.affectedRows > 0) {
            return res.json({ message: 'Hospital eliminado exitosamente' });
        }
        else {
            return res.status(404).json({ error: 'Hospital no encontrado' });
        }
    }
    catch (error) {
        console.error('Error al eliminar el hospital:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
app.get('/api/hospital', async (_req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM hospital');
        if (rows.length > 0) {
            return res.status(200).json(rows);
        }
        else {
            return res.status(404).json({ message: 'No se encontraron hospitales' });
        }
    }
    catch (error) {
        console.error('Error al obtener los pagos:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
exports.default = app;
function generateJWT(user) {
    throw new Error('Function not implemented.');
}
//# sourceMappingURL=server.js.map