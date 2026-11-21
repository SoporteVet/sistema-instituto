# Sistema de Gestión — Instituto Veterinario

Sistema web SPA (HTML + CSS + JavaScript + Firebase) para la gestión académica de un instituto veterinario.

## Funcionalidades

| Módulo | Descripción |
|---|---|
| **Dashboard** | Indicadores: estudiantes activos, inscripciones, pagos pendientes, bloqueados |
| **Estudiantes** | Alta, edición, baja y búsqueda de estudiantes |
| **Cursos** | Gestión de cursos secuenciales con conceptos de pago y requisitos |
| **Inscripciones & Pagos** | Inscribir estudiantes; checklist de pagos por curso |
| **Notas** | Registro y edición de calificaciones por estudiante/curso |
| **Progreso** | Línea de avance visual: aprobado / en curso / disponible / bloqueado |
| **Horas de práctica** | Kiosco de entrada/salida por cédula y área; historial y totales por área en el perfil |
| **Usuarios** | Gestión de usuarios del sistema (solo admin) |

## Configuración paso a paso

### 1. Crear proyecto Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto (ej. `instituto-veterinario`)
3. En **Build → Authentication** → *Get started* → habilita **Email/Password**
4. En **Build → Firestore Database** → *Create database* → selecciona **Production mode** y elige tu región

### 2. Obtener credenciales

1. En Firebase Console: **Configuración del proyecto** (⚙️) → **Tus apps** → botón `</>` (Web)
2. Registra la app (cualquier nombre)
3. Copia el objeto `firebaseConfig`

### 3. Pegar credenciales en el proyecto

Abre `js/firebase-config.js` y reemplaza los valores placeholder:

```js
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc..."
};
```

### 4. Crear el primer usuario administrador

Como no hay backend, el primer admin se crea en dos pasos:

**A) Crear cuenta en Firebase Auth:**
1. Firebase Console → Authentication → Users → **Add user**
2. Ingresa email y contraseña
3. Copia el **UID** generado (columna "User UID")

**B) Crear documento en Firestore:**
1. Firebase Console → Firestore Database → **Start collection**
2. Collection ID: `users`
3. Document ID: pega el UID del paso anterior
4. Agrega estos campos:
   ```
   nombre  (string)  →  Tu Nombre
   email   (string)  →  tu@email.com
   rol     (string)  →  admin
   activo  (boolean) →  true
   ```

### 5. Aplicar reglas de seguridad

En Firebase Console → Firestore → **Rules**, pega el contenido de `firestore.rules` y publica.

### 6. Abrir el sistema

Abre `index.html` en tu navegador. Para desarrollo local recomendamos un servidor:

```bash
# Con Python
python -m http.server 8080

# Con Node (npx)
npx serve .

# Con VS Code
# Instala "Live Server" y haz clic en "Go Live"
```

Luego abre: [http://localhost:8080](http://localhost:8080)

---

## Despliegue con Firebase Hosting (opcional)

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Inicializar hosting en este directorio
firebase init hosting
# → Selecciona tu proyecto
# → Public directory: . (punto)
# → Single-page app: NO
# → Overwrite index.html: NO

# Desplegar
firebase deploy --only hosting
```

---

## Estructura de archivos

```
sistema_instituto/
├── index.html                  ← SPA shell
├── firestore.rules             ← Reglas de seguridad Firestore
├── css/
│   └── styles.css              ← Sistema de diseño completo
└── js/
    ├── firebase-config.js      ← TUS credenciales (ignorado por git)
    ├── firebase-config.example.js ← Plantilla de credenciales
    ├── firebase.js             ← Inicialización Firebase
    ├── main.js                 ← Punto de entrada
    ├── auth.js                 ← Autenticación y roles
    ├── router.js               ← Enrutamiento hash
    ├── ui.js                   ← Utilidades UI (modal, toast, etc.)
    ├── services/
    │   └── db.js               ← CRUD Firestore
    ├── logic/
    │   └── progression.js      ← Lógica de avance académico
    └── views/
        ├── dashboard.js
        ├── students.js
        ├── courses.js
        ├── enrollments.js
        ├── grades.js
        ├── progress.js
        └── users.js
```

---

## Modelo de datos Firestore

### `users/{uid}`
```json
{
  "nombre": "María López",
  "email": "maria@instituto.com",
  "rol": "admin",
  "activo": true
}
```

### `students/{id}`
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "documento": "1234567",
  "email": "juan@email.com",
  "telefono": "555-0000",
  "fechaNacimiento": "2000-05-15",
  "fechaIngreso": "2024-01-10",
  "estado": "activo",
  "notas": ""
}
```

### `courses/{id}`
```json
{
  "codigo": "ATV-001",
  "nombre": "Anatomía Veterinaria",
  "orden": 1,
  "notaMinima": 70,
  "prerequisitoId": null,
  "paymentItems": [
    { "id": "item_1", "nombre": "Matrícula", "monto": 500 },
    { "id": "item_2", "nombre": "Mensualidad 1", "monto": 800 }
  ],
  "requisitos": {
    "cursoPrevio": false,
    "notaMinima": true,
    "pagosCompletos": true
  }
}
```

### `enrollments/{id}`
```json
{
  "studentId": "abc123",
  "courseId": "def456",
  "nota": 85,
  "pagos": {
    "item_1": { "pagado": true,  "fecha": "2024-01-15" },
    "item_2": { "pagado": false, "fecha": null }
  }
}
```

---

## Roles

| Rol | Acceso |
|---|---|
| `admin` | Todo: CRUD estudiantes, cursos, inscripciones, pagos, notas, usuarios |
| `profesor` | Leer todo + editar notas y pagos (no puede crear/eliminar) |

---

## Lógica de progresión

Un curso queda **aprobado** cuando cumple los requisitos habilitados:
- ✅ **Nota mínima**: `nota >= notaMinima`
- ✅ **Pagos completos**: todos los `paymentItems` marcados como `pagado: true`
- ✅ **Curso previo**: el curso anterior (por `orden`) está aprobado

Un curso está **bloqueado** si su prerequisito no está aprobado.
