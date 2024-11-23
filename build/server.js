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
const bcrypt = __importStar(require("bcryptjs"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const express_session_1 = __importDefault(require("express-session"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const paypal = __importStar(require("@paypal/checkout-server-sdk"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const winston_1 = __importDefault(require("winston"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Configuración de CORS
app.use((0, cors_1.default)({
    origin: 'https://citasmedicas4.netlify.app',
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
// En tu server.ts antes de compilar
app.use((req, res, next) => {
    console.log('Request Path:', req.path);
    console.log('Request Method:', req.method);
    console.log('Request Headers:', req.headers);
    next();
});
// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// Ejemplo de ruta para verificar el funcionamiento de la API
app.get('/', (_req, res) => {
    res.send('API de Citas Médicas con APIs funcionando correctamente!!!');
});
// Configuración de PayPal
const PAYPAL_CLIENT_ID = 'AUJbTRPDtHgHEMJ4Dvt6Rc9wTyfB2pWWxc1KYz3EiwdgwcZDoS5JPi2L_UmrtjmYL5K9OBnei_Mo9365';
const PAYPAL_CLIENT_SECRET = 'ELnZHD9kkgGbdOpv3lsYYOxLg7dejIG4sOiwYnBW0aTuTuPQHKFFJya92qLyV0nOFlGDspVkl60S06S9';
const environment = new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
const client = new paypal.core.PayPalHttpClient(environment);
//Para las notificaciones de facebook
// Configuración del transporter de nodemailer
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
//TODO LO QUE SIGUE ES PARA PAYPAL
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'combined.log' })
    ]
});
// Función para enviar comprobante de pago por correo
async function enviarComprobantePago(emailHospital, detallesPago, idTransaccion) {
    logger.info(`Iniciando envío de comprobante a: ${emailHospital}`);
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: emailHospital,
            subject: 'Comprobante de Pago - Citas Médicas',
            html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Comprobante de Pago - Citas Médicas</title>
        </head>
        <body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Encabezado -->
            <div style="text-align: center; margin-bottom: 30px; padding: 20px;">
              <h1 style="color: #1a73e8; margin: 0; font-size: 28px; font-weight: 600;">Citas Médicas</h1>
            </div>

            <!-- Contenedor Principal -->
            <div style="background-color: white; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 30px; margin-bottom: 30px;">
              <!-- Mensaje de éxito -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #e8f5e9; border-radius: 50%; width: 60px; height: 60px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: #1DB954; font-size: 30px;">✓</span>
                </div>
                <h2 style="color: #1DB954; margin: 0; font-size: 22px;">¡Pago Exitoso!</h2>
                <p style="color: #5f6368; margin-top: 10px;">Gracias por su pago. A continuación, encontrará los detalles de su transacción.</p>
              </div>

              <!-- Detalles de la transacción -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                  <tr>
                    <td style="color: #5f6368; font-weight: 500; padding: 8px 0;">ID de Transacción</td>
                    <td style="text-align: right; color: #1a73e8; font-weight: 600;">${idTransaccion}</td>
                  </tr>
                  <tr>
                    <td style="color: #5f6368; font-weight: 500; padding: 8px 0;">Monto Pagado</td>
                    <td style="text-align: right; color: #1DB954; font-weight: 600; font-size: 20px;">$${detallesPago.purchase_units[0].amount.value}</td>
                  </tr>
                  <tr>
                    <td style="color: #5f6368; font-weight: 500; padding: 8px 0;">Fecha y Hora</td>
                    <td style="text-align: right; color: #5f6368;">${new Date().toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="color: #5f6368; font-weight: 500; padding: 8px 0;">Método de Pago</td>
                    <td style="text-align: right;">
                      <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" style="height: 20px; vertical-align: middle;"> PayPal
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Información de contacto -->
              <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h3 style="color: #1a73e8; margin-bottom: 15px; font-size: 18px;">¿Necesita ayuda?</h3>
                <p style="color: #5f6368; margin-bottom: 15px;">Estamos aquí para ayudarle. Contáctenos a través de:</p>
                <div style="display: inline-block; text-align: center;">
                  <div style="margin-bottom: 10px;">
                    <span style="color: #1a73e8;">📧</span>
                    <a href="mailto:soporte@citasmedicas.com" style="color: #1a73e8; text-decoration: none;">soporte@citasmedicas.com</a>
                  </div>
                  <div>
                    <span style="color: #1a73e8;">📞</span>
                    <a href="tel:+524151775265" style="color: #1a73e8; text-decoration: none;">+52 415 177 52 65</a>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pie de página -->
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #5f6368; font-size: 12px; margin-bottom: 10px;">Este es un correo electrónico automático, por favor no responda a este mensaje.</p>
              <p style="color: #5f6368; font-size: 12px;">&copy; ${new Date().getFullYear()} Citas Médicas. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `
        });
        logger.info('Correo enviado exitosamente:', info.messageId);
        return info;
    }
    catch (error) {
        logger.error('Error al enviar el correo:', error);
        throw error;
    }
}
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
    var _a;
    logger.info('Iniciando proceso de pago PayPal');
    logger.info('Datos recibidos:', req.body);
    try {
        const { idHospital, monto, detallesPago } = req.body;
        if (!detallesPago || !detallesPago.id || !idHospital || !monto) {
            logger.warn('Faltan datos requeridos para el pago PayPal');
            return res.status(400).json({ message: 'Faltan datos requeridos' });
        }
        logger.info(`Procesando pago para hospital ID: ${idHospital}, monto: ${monto}`);
        // Verificar si el pago ya está registrado en la base de datos
        const [existingPayment] = await pool.execute('SELECT * FROM pagos WHERE idHospital = ? AND transactionID = ?', [idHospital, detallesPago.id]);
        if (existingPayment.length > 0) {
            logger.info('El pago ya está registrado en la base de datos');
            return res.json({
                message: 'El pago ya ha sido procesado anteriormente',
                transactionID: detallesPago.id,
            });
        }
        // Obtener detalles de la orden de PayPal
        const getOrderRequest = new paypal.orders.OrdersGetRequest(detallesPago.id);
        const orderDetails = await client.execute(getOrderRequest);
        logger.info('Estado de la orden de PayPal:', orderDetails.result.status);
        let captureResponse;
        if (orderDetails.result.status !== 'COMPLETED') {
            // Si la orden no ha sido capturada, proceder con la captura
            const captureRequest = new paypal.orders.OrdersCaptureRequest(detallesPago.id);
            captureResponse = await client.execute(captureRequest);
            logger.info('Captura de pago completada:', captureResponse.result.status);
            if (captureResponse.result.status !== 'COMPLETED') {
                logger.error('La transacción de PayPal no fue completada:', captureResponse.result);
                return res.status(400).json({ message: 'La transacción de PayPal no fue completada' });
            }
        }
        else {
            captureResponse = orderDetails;
            logger.info('La orden ya ha sido capturada previamente');
        }
        const montoPagado = captureResponse.result.purchase_units[0].payments.captures[0].amount.value;
        // Registro de pago en la base de datos
        logger.info('Registrando pago en la base de datos');
        const [result] = await pool.execute('INSERT INTO pagos (numeroTarjeta, nombreTitular, fechaExpiracion, codigoSeguridad, monto, idHospital, fechaPago, transactionID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['PayPal', `${captureResponse.result.payer.name.given_name} ${captureResponse.result.payer.name.surname}`, 'N/A', 'N/A', montoPagado, idHospital, new Date(), detallesPago.id]);
        logger.info(`Pago registrado en la base de datos, ID: ${result.insertId}`);
        // Obtener correo del hospital
        const [hospitalRows] = await pool.execute('SELECT correo FROM hospital WHERE idHospital = ?', [idHospital]);
        const emailHospital = (_a = hospitalRows[0]) === null || _a === void 0 ? void 0 : _a.correo;
        logger.info(`Correo del hospital obtenido: ${emailHospital}`);
        let comprobante_enviado = false;
        if (emailHospital) {
            try {
                logger.info(`Intentando enviar comprobante a: ${emailHospital}`);
                await enviarComprobantePago(emailHospital, captureResponse.result, detallesPago.id);
                logger.info('Comprobante enviado exitosamente');
                comprobante_enviado = true;
            }
            catch (emailError) {
                logger.error('Error al enviar el comprobante:', emailError);
                // No lanzamos el error para no interrumpir el proceso, pero lo registramos
            }
        }
        else {
            logger.warn(`No se encontró correo para el hospital con ID: ${idHospital}`);
        }
        res.json({
            message: 'Pago de PayPal procesado con éxito',
            transactionID: captureResponse.result.id,
            idPago: result.insertId,
            comprobante_enviado,
        });
    }
    catch (error) {
        logger.error('Error al procesar el pago de PayPal:', error);
        res.status(500).json({ message: 'Error al procesar el pago', error: error instanceof Error ? error.message : String(error) });
    }
});
app.post('/api/hospitales', async (req, res) => {
    try {
        const { nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto, correo } = req.body;
        if (!nombreHospital || !direccion || !estado || !municipio || !telefono || !nomRepresHospital || !rfcHospital || !monto || !correo) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        const [result] = await pool.query('INSERT INTO hospital (nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto, correo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nombreHospital, direccion, estado, municipio, numSucursal, telefono, nomRepresHospital, rfcHospital, monto, correo]);
        // Enviar correo al hospital recién registrado
        //AQUI YA LO DE NOTAS
        res.status(201).json({ message: 'Hospital registrado con éxito', idHospital: result.insertId });
    }
    catch (error) {
        console.error('Error al guardar el hospital:', error);
        res.status(500).json({ message: 'Error al guardar el hospital', error: error.message });
    }
});
// LOGIN DE FACEBOOK
app.post('/api/facebook-login', async (req, res) => {
    try {
        const { email, name, id } = req.body;
        // Buscar si el usuario ya existe
        const [existingUsers] = await pool.execute('SELECT * FROM usuarios WHERE correo = ?', [email]);
        let userId;
        if (existingUsers.length > 0) {
            // El usuario ya existe, actualiza sus datos
            userId = existingUsers[0].id;
            await pool.execute('UPDATE usuarios SET nombre = ?, google_id = ? WHERE id = ?', [name, id, userId]);
        }
        else {
            // El usuario no existe, créalo
            const [result] = await pool.execute('INSERT INTO usuarios (nombre, correo, google_id) VALUES (?, ?, ?)', [name, email, id]);
            userId = result.insertId;
        }
        // Registrar el intento de inicio de sesión
        await pool.execute('INSERT INTO login_attempts (usuario_id, exitoso) VALUES (?, ?)', [userId, true]);
        // Enviar notificación por correo
        let emailSent = false;
        try {
            await sendLoginNotification(email);
            emailSent = true;
        }
        catch (emailError) {
            console.error('Error al enviar email de notificación:', emailError);
        }
        // Respuesta exitosa con información del usuario
        res.json({
            isAuthenticated: true,
            userId: userId.toString(),
            userName: name,
            emailSent: emailSent // Indica si se envió el correo
        });
    }
    catch (error) {
        console.error('Error en el login con Facebook:', error);
        // Manejar errores y responder con un mensaje adecuado
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});
// Función para enviar correo de notificación de inicio de sesión
async function sendLoginNotification(userEmail) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Inicio de sesión - Citas Médicas',
            html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Inicio de sesión - Citas Médicas</title>
        </head>
        <body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header con efecto gradiente -->
            <div style="text-align: center; background: linear-gradient(135deg, #1a73e8, #0056b3); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Citas Médicas</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px;">Sistema de Gestión Médica</p>
            </div>

            <!-- Contenedor Principal -->
            <div style="background-color: white; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 30px; margin-bottom: 30px;">
              <!-- Ícono de notificación -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #e8f0fe; border-radius: 50%; width: 70px; height: 70px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 30px;">🔐</span>
                </div>
                <h2 style="color: #1a73e8; margin: 0; font-size: 24px;">Nuevo Inicio de Sesión Detectado</h2>
                <p style="color: #5f6368; margin-top: 10px;">Se ha registrado un nuevo acceso a tu cuenta.</p>
              </div>

              <!-- Mensaje principal -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                <p style="color: #202124; margin: 0 0 15px 0; font-size: 16px;">
                  Hemos detectado un nuevo inicio de sesión en tu cuenta. Si fuiste tú, puedes ignorar este mensaje. Si no reconoces esta actividad, por favor toma acción inmediata.
                </p>
                <div style="text-align: center;">
                  <p style="color: #5f6368; margin: 5px 0;">
                    <strong>Fecha y Hora:</strong> ${new Date().toLocaleString()}
                  </p>
                </div>
              </div>

              <!-- Botón de contacto -->
              <div style="text-align: center; margin-top: 30px;">
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                  <h3 style="color: #1a73e8; margin: 0 0 15px 0; font-size: 18px;">¿Necesitas ayuda?</h3>
                  <p style="color: #5f6368; margin-bottom: 20px;">Nuestro equipo de soporte está disponible 24/7</p>
                  <div style="margin-bottom: 10px;">
                    <a href="tel:+524151775265" style="color: #1a73e8; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                      📞 +52 415 177 52 65
                    </a>
                  </div>
                  <div>
                    <a href="mailto:soporte@citasmedicas.com" style="color: #1a73e8; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                      📧 soporte@citasmedicas.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #5f6368; font-size: 12px; margin-bottom: 10px;">
                Este es un correo electrónico automático de seguridad. Por favor, no responda a este mensaje.
              </p>
              <p style="color: #5f6368; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Citas Médicas. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
        });
        console.log('Email de notificación enviado');
    }
    catch (error) {
        console.error('Error al enviar email:', error);
    }
}
//Para la api de base de datos de medicamnetos 
// Ruta para buscar medicamento
app.get('/api/drugs/search/:name', async (req, res) => {
    try {
        const drugName = encodeURIComponent(req.params.name);
        const url = `https://api.fda.gov/drug/label.json?api_key=${process.env.FDA_API_KEY}&search=brand_name:"${drugName}"&limit=1`;
        console.log('URL de búsqueda:', url); // Para depuración
        const response = await (0, node_fetch_1.default)(url);
        const data = await response.json();
        res.json(data);
    }
    catch (error) {
        logger.error('Error buscando medicamento:', error);
        res.status(500).json({
            message: 'Error al buscar medicamento',
            error: error.message
        });
    }
});
// Ruta para obtener efectos adversos
app.get('/api/drugs/adverse-effects/:name', async (req, res) => {
    try {
        const drugName = encodeURIComponent(req.params.name);
        const url = `https://api.fda.gov/drug/event.json?api_key=${process.env.FDA_API_KEY}&search=patient.drug.openfda.brand_name:"${drugName}"&limit=10`;
        console.log('URL de búsqueda efectos adversos:', url); // Para depuración
        const response = await (0, node_fetch_1.default)(url);
        const data = await response.json();
        res.json(data);
    }
    catch (error) {
        logger.error('Error obteniendo efectos adversos:', error);
        res.status(500).json({
            message: 'Error al obtener efectos adversos',
            error: error.message
        });
    }
});
// Configuración de la estrategia de GitHub
passport_1.default.use(new passport_github2_1.Strategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || "https://backend-4-seven.vercel.app/api/auth/github/callback"
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
        res.redirect(`https://citasmedicas4.netlify.app/citas;userId=${user.id};userName=${encodedUserName}?token=${token}`);
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
    res.redirect(`https://citasmedicas4.netlify.app/auth-callback?token=${token}`);
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
        const hashedPassword = await bcrypt.hash(contrase, 10);
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
            const isMatch = await bcrypt.compare(contrase, user.contrase);
            await pool.execute('INSERT INTO login_attempts (usuario_id, exitoso) VALUES (?, ?)', [user.id, isMatch]);
            if (isMatch) {
                // Enviar notificación por correo
                await sendLoginNotification(correo);
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
// Iniciar el servidor
exports.default = app;
//# sourceMappingURL=server.js.map