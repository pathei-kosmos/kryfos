const express = require("express");
const compression = require("compression");
require("dotenv").config();
const morgan = require("morgan");
const helmet = require("helmet");
const hpp = require("hpp");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("./models/user");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const app = express();
const expressWs = require("express-ws")(app);
const { body, validationResult } = require("express-validator");
const { decode } = require("html-entities");

// secures the websocket server
const authorizedOrigin = `http://${process.env.DOMAIN}`;

// launch
mongoose
  .connect(process.env.DBURI)
  .then(() => {
    // protects against query selector injection attacks
    mongoose.set("sanitizeFilter", true);
    console.log("✔️   connected to db");
    app.listen(process.env.PORT, () =>
      console.log(`✔️   server listening on port ${process.env.PORT}...`)
    );
  })
  .catch((e) => console.log("❌  ", e));

// --- MIDDLEWARES ---
// define static folder
app.use(express.static("public"));
// compress all HTTP responses
app.use(compression());
// POST requests body parser
app.use(express.urlencoded({ extended: true }));
// protect against HTTP Parameter Pollution attacks
app.use(hpp());
// secure HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", `${process.env.DOMAIN}`, "'unsafe-inline'"],
        defaultSrc: [
          "'self'",
          `${process.env.DOMAIN}`,
          `ws://${process.env.DOMAIN}`,
          `ws://${process.env.DOMAIN}/chat`,
        ],
      },
    },
  })
);
// reduce fingerprinting
app.disable("x-powered-by");
// logger
app.use(morgan("dev"));

// session auth
app.use(
  session({
    //  add secure: true when https is enabled
    cookie: { maxAge: 86400000, sameSite: true },
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    resave: false,
    secret: process.env.SECRET_KEY_SESSION,
    saveUninitialized: false,
    name: "kryfos.sid",
  })
);

// register view engine
app.set("view engine", "ejs");

//  --- ROUTING ---
// homepage and login form
app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect("/chat");
  } else {
    res.render("index");
  }
});

// sign up form
app.get("/inscription", (req, res) => {
  if (req.session.user) {
    res.redirect("/chat");
  } else {
    res.render("inscription");
  }
});

// POST sign up form request
app.post(
  "/inscription",
  // validates and sanitizes inputs
  [
    body("email").isEmail().trim().normalizeEmail().escape(),
    body("pseudo").isString().trim().isLength({ max: 16 }).escape(),
    body("pwd").isString().trim().isLength({ min: 8 }).escape(),
    body("pwdConf").isString().trim().isLength({ min: 8 }).escape(),
  ],
  (req, res) => {
    const { email, pseudo, pwd, pwdConf } = req.body;

    // redirects if input validation failed
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render("message", {
        titre: "Message",
        msg: "Données fournies incorrectes.",
        url: "/inscription",
        btn: "Revenir",
      });
    } else if (pwd !== pwdConf) {
      // checks that the passwords match
      res.render("message", {
        titre: "Message",
        msg: "Les mots de passe ne correspondent pas.",
        url: "/inscription",
        btn: "Revenir",
      });
    } else {
      // checks if the user already exists
      User.findOne({ mail_user: email })
        .then((r) => {
          if (r) {
            res.render("message", {
              titre: "Message",
              msg: "Un compte existe déjà à cette adresse.",
              url: "/inscription",
              btn: "Revenir",
            });
          } else {
            bcrypt.hash(pwd, 10, function (err, hash) {
              if (err) {
                throw err;
              }

              const user = new User({
                mail_user: email,
                pwd_user: hash,
                pseudo_user: pseudo,
              });

              user
                .save()
                .then(() =>
                  console.log(`✍️   ${user.pseudo_user} has signed up`)
                )
                .catch((e) => console.log("❌  ", e));
              res.render("message", {
                titre: "Message",
                msg: "Le compte a été créé.",
                url: "/",
                btn: "Revenir",
              });
            });
          }
        })
        .catch((e) => console.log("❌  ", e));
    }
  }
);

// POST login form request
app.post(
  "/",
  // validates and sanitizes inputs
  [
    body("email").isEmail().trim().normalizeEmail().escape(),
    body("pwd").isString().escape(),
  ],
  (req, res) => {
    const { email, pwd } = req.body;

    // redirects if input validation failed
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render("message", {
        titre: "Message",
        msg: "Données fournies incorrectes.",
        url: "/",
        btn: "Revenir",
      });
    } else {
      // checks if the user exists
      User.findOne({ mail_user: email })
        .then((r) => {
          if (r) {
            // check if the passwords match
            bcrypt.compare(pwd, r.pwd_user, function (err, result) {
              if (result) {
                // generate a new session
                req.session.regenerate((err) => {
                  if (err) {
                    return err;
                  }

                  // load the data of the connected user in session
                  // (decodes the pseudo if it contains escaped special characters)
                  req.session.user = {
                    mail: r.mail_user,
                    pseudo: decode(r.pseudo_user, { level: "html5" }),
                  };

                  // save the session before redirection to ensure page
                  req.session.save((err) => {
                    if (err) {
                      return err;
                    }

                    res.render("message", {
                      titre: "Message",
                      msg: "Connexion réussie !",
                      url: "/chat",
                      btn: "Continuer",
                    });
                  });
                });
              } else {
                res.render("message", {
                  titre: "Message",
                  msg: "Identifiants incorrects.",
                  url: "/",
                  btn: "Revenir",
                });
              }
            });
          } else {
            res.render("message", {
              titre: "Message",
              msg: "Identifiants incorrects.",
              url: "/",
              btn: "Revenir",
            });
          }
        })
        .catch((e) => console.log("❌  ", e));
    }
  }
);

// message page
app.get("/message", (req, res) => {
  res.render("message");
});

// chat page
app.get("/chat", (req, res) => {
  if (req.session.user) {
    res.render("chat");
  } else {
    res.clearCookie("kryfos.sid");
    res.redirect("/");
  }
});

// logout event
app.get("/logout", (req, res) => {
  // if the user still has a cookie but the server no longer has the session
  if (!req.session.user) {
    res.clearCookie("kryfos.sid");
    res.redirect("/");
  } else {
    // destroy the session cookie
    res.clearCookie("kryfos.sid");

    // wipe the session object
    req.session.user = null;
    req.session.save((err) => {
      if (err) {
        throw err;
      }

      // destroy the session
      req.session.destroy((err) => {
        if (err) {
          throw err;
        }
        res.redirect("/");
      });
    });
  }
});

//  --- WEBSOCKETS ---
// MODELS
// { event: "pseudo", payload: "pseudo" }
// { event: "message", payload, author }
// { event: "ping" }
// { event: "connectedUsers", payload: ['array', 'of', 'session', 'pseudos'] }

// list of connected clients (websocket instances)
let connects = [];
// list of connected clients (session pseudos)
let connectedUsers = [];

// starts the websocket server on the chat route
app.ws("/chat", (ws, req) => {
  // prevents websocket connections from other sources than the chat
  if (req.get("origin") !== authorizedOrigin) {
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
    console.log(`⚠️   websocket connection attempt from an unknown source
Source : ${req.get("origin")}
IP : ${ip}
User-Agent : ${req.get("user-agent")}`);
    ws.terminate();
  } else {
    const pseudo = req.session.user.pseudo;
    // sends the session pseudo to the client
    ws.send(JSON.stringify({ event: "pseudo", payload: pseudo }));

    console.log(`🤝   ${pseudo} has entered the chat`);

    // adds to the lists of connected clients (websocket instances && session pseudos)
    // (only if the user is not already logged in)
    if (!connects.includes(ws)) {
      connects.push(ws);
    }
    if (!connectedUsers.includes(pseudo)) {
      connectedUsers.push(pseudo);
    }

    // sends the list of connected users (session pseudos) to the client
    connects.forEach((socket) => {
      socket.send(
        JSON.stringify({ event: "connectedUsers", payload: connectedUsers })
      );
    });

    // at the reception of data
    ws.on("message", (msg) => {
      msg = JSON.parse(msg);

      // pong if it's a ping, otherwise broadcast the message
      if (msg.event === "ping") {
        ws.send(JSON.stringify({ event: "pong" }));
        return;
      } else if (msg.event === "message") {
        let { payload, author } = msg;
        console.log(`💬   ${author}:`, payload);
        connects.forEach((socket) => {
          socket.send(JSON.stringify({ event: "message", payload, author }));
        });
      }
    });

    ws.on("close", () => {
      // removes disconnected clients (websocket instances)
      connects = connects.filter((conn) => {
        return conn === ws ? false : true;
      });

      // removes disconnected clients (session pseudos)
      connectedUsers = connectedUsers.filter((conn) => {
        return conn === pseudo ? false : true;
      });

      // sends the uptaded list of connected users (session pseudos) to the client
      connects.forEach((socket) => {
        socket.send(
          JSON.stringify({ event: "connectedUsers", payload: connectedUsers })
        );
      });

      console.log(`👋   ${req.session.user.pseudo} has left the chat`);
    });
  }
});

// 404 page
app.use((req, res) => {
  res.status(404).render("message", {
    msg: "Erreur 404 : la page n'existe pas.",
    url: "/",
    btn: "Revenir",
  });
});
