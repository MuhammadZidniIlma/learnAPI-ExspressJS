import express, { request } from 'express';
import { PrismaClient } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';


const app = express();
const prisma = new PrismaClient();
// app.use(cors())
app.use(express.json())

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET_KEY;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid' });
    req.user = decoded;
    next();
  });
}


app.get('/todos', async (req, res) => {
    const todos = await prisma.todoList.findMany()        
    res.json({
        succes : true,
        message : "Data Berhasil Didapat",
        data : todos
    },{
        status : 200
    })
    
})


app.get('/todos/search', async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      success: false,
      message: "Query parameter 'q' wajib diisi dan harus string",
    });
  }

  try {
    const todos = await prisma.todoList.findMany({
  where: {
    OR: [
      { title: { contains: q } },
      { deskripsi: { contains: q } }
    ]
  }
});


    res.status(200).json({
      success: true,
      message: `Hasil pencarian untuk keyword '${q}'`,
      data: todos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat pencarian",
      error: error.message,
    });
  }
});


app.get('/todos/:id', async (req, res) => {
  const id = Number(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: "Parameter 'id' harus berupa angka yang valid",
    });
  }

  try {
    const todo = await prisma.todoList.findUnique({
      where: { id }
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Data todo tidak ditemukan"
      });
    }

    res.status(200).json({
      success: true,
      message: "Berhasil Mendapatkan Data Detail",
      data: todo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
      error: error.message,
    });
  }
});


app.post('/todos', async (req, res) => {
  try {
    const { title, deskripsi } = req.body;

    const todo = await prisma.todoList.create({
      data: { title, deskripsi },
    });

    res.status(200).json({
      success: true,
      message: "Berhasil Menambahkan Data",
      data: todo,
    });
  } catch (error) {    
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
});

app.put('/todos/:id', async (req, res) => {
    const todo = await prisma.todoList.update({
        where : {
            id : Number(req.params.id)
        },
        data : req.body
    })    
    res.json({
        succes : true,
        message : "Berhasil Mengubah Data",
        data : todo
    },{
        status : 200
    })
})

app.delete('/todos/:id', async (req, res) => {
    const todo = await prisma.todoList.delete({
        where : {
            id : Number(req.params.id)
        }
    })    
    res.json({
        succes : true,
        message : "Berhasil Menghapus Data",
        data : todo
    },{
        status : 200
    })
})


app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({ data: { email, name } });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

app.get('/users' , async (req, res) => {

    const users = await prisma.user.findMany()
    res.json({
        success : true,
        message : "Data Berhasil Didapat",
        data : users
    },
    {
        status : 200
    })
})


app.post('/users', async (req, res) => {
  const { name, email, password, noHp } = req.body;

  if (!name || !email || !password || !noHp) {
    return res.status(400).json({ success: false, message: "Semua field wajib diisi" });
  }

  try {
    // Cek apakah email sudah digunakan
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email sudah terdaftar" });
    }

    // Simpan user (sementara tanpa hash password, bisa ditambah bcrypt nanti)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password, // NOTE: jangan lupa hash di production
        noHp
      },
    });

    res.status(201).json({ success: true, message: "User berhasil dibuat", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan server", error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: "Email atau password salah" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });

    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan server", error: error.message });
  }
});

app.put('/users/:id', async (req, res) => {
  const {name, email, password, noHp} =req.body  
  try {
    const user = await prisma.user.update({
    where : {
        id : Number(req.params.id)
    },
    data : {
        name,
        email,
        password,
        noHp
    }
  })
  res.json({
    success : true,
    message : "Berhasil Mengubah Data",
    data : user
  },{
    status : 201
  })
  } catch (error) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan server", error: error.message });
  }

})
// Mendapatkan detail profil user yang sedang login
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        noHp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: error.message,
    });
  }
});




const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));