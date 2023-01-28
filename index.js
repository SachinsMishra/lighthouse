require('dotenv').config();
const axios = require('axios');
const express = require('express');
const session = require('express-session');
const { Issuer, Strategy } = require('openid-client');
const passport = require('passport');
const https = require('https');
const env = 'sandbox';
const ROOT_URL = `https://${env}-api.va.gov/oauth2/.well-known/openid-configuration`;
const client_id = "0oakletvtp4y5Nd922p7";//process.env.CLIENT_ID;
const client_secret = "TZOSisTaTqUFqjjTVEKET4jTiIskJ2AJbn0GO4g7";//process.env.CLIENT_SECRET;
var bodyParser = require('body-parser');

const createClient = async () => {
  Issuer.defaultHttpOptions = { timeout: 2500 };
  return Issuer.discover(ROOT_URL).then(issuer => {
    return new issuer.Client({
      client_id,
      client_secret,
      redirect_uris: [
        'http://localhost:8080/auth/cb'
      ],
    });
  });
}

const configurePassport = (client) => {
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  passport.use('oidc', new Strategy(
    {
      client,
      params: {
        scope: 'profile openid offline_access disability_rating.read service_history.read veteran_status.read claim.read',
      },
    }, (tokenset, userinfo, done) => {
      done(null, { userinfo, tokenset });
    }
  ));
}

const userDetails = async (req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    res.send(req.session.passport.user);
    next();
  } else {
    res.redirect('/auth'); // Redirect the user to login if they are not
    next();
  }
}

const getJWT = async (req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    res.json({ jwt: `${req.session.passport.user.tokenset.access_token}` });
    next();
  } else {
    res.json(null); // Redirect the user to login if they are not
    next();
  }
};

const verifyVeteranStatus = async (req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    const veteranStatus = await new Promise((resolve, reject) => {
      https.get(
        `https://${env}-api.va.gov/services/veteran_verification/v1/status`,
        { headers: { 'Authorization': `Bearer ${req.session.passport.user.tokenset.access_token}` } },
        (res) => {
          let rawData = '';
          if (res.statusCode !== 200) {
            reject(new Error('Request Failed'));
          }
          res.setEncoding('utf-8');
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsedOutput = JSON.parse(rawData);
              resolve(parsedOutput);
            } catch (err) {
              reject(err);
            }
          });
        }
      ).on('error', reject);
    });
    res.json({ veteranStatus: veteranStatus });
    next();
  } else {
    res.redirect('/auth'); // Redirect the user to login if they are not
    next();
  }
};

const verifyDisabilityRating = async (req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    const veteranDisabilityRating = await new Promise((resolve, reject) => {
      https.get(
        `https://${env}-api.va.gov/services/veteran_verification/v1/disability_rating`,
        { headers: { 'Authorization': `Bearer ${req.session.passport.user.tokenset.access_token}` } },
        (res) => {
          let rawData = '';
          if (res.statusCode !== 200) {
            reject(new Error('Request Failed'));
          }
          res.setEncoding('utf-8');
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsedOutput = JSON.parse(rawData);
              resolve(parsedOutput);
            } catch (err) {
              reject(err);
            }
          });
        }
      ).on('error', reject);
    });
    res.json({ veterandisabilityRating: veteranDisabilityRating });
    next();
  } else {
    res.redirect('/auth'); // Redirect the user to login if they are not
    next();
  }
};

const verifyServiceHistory = async (req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    const verifyServiceHistory = await new Promise((resolve, reject) => {
      https.get(
        `https://${env}-api.va.gov/services/veteran_verification/v1/service_history`,
        { headers: { 'Authorization': `Bearer ${req.session.passport.user.tokenset.access_token}` } },
        (res) => {
          let rawData = '';
          if (res.statusCode !== 200) {
            reject(new Error('Request Failed'));
          }
          res.setEncoding('utf-8');
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsedOutput = JSON.parse(rawData);
              resolve(parsedOutput);
            } catch (err) {
              reject(err);
            }
          });
        }
      ).on('error', reject);
    });
    res.json({ verifyServiceHistory: verifyServiceHistory });
    next();
  } else {
    res.redirect('/auth'); // Redirect the user to login if they are not
    next();
  }
};

const wrapAuth = async (req, res, next) => {
  //Passport or OIDC don't seem to set 'err' if our Auth Server sets them in the URL as params so we need to do this to catch that instead of relying on callback
  if (req.query.error) {
    return next(req.query.error_description);
  }
  passport.authenticate("oidc", { successRedirect: "/", failureRedirect: "/" })(req, res, next);
};

const loggedIn = (req) => {
  return req.session && req.session.passport && req.session.passport.user;
}

const startApp = (client) => {
  const app = express();
  const port = 8080;
  const secret = 'My Super Secret Secret'
  // let db = new sqlite3.Database('./db/lighthouse.sqlite', (err) => {
  //   if (err) {
  //     return console.error(err.message);
  //   }
  //   console.log('Connected to SQlite database.');
  // });

  app.set('view engine', 'ejs')
  app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(session({ secret, cookie: { maxAge: 60000 }, resave: true, saveUninitialized: true }));
  app.use(bodyParser.json()); // support json encoded bodies
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    var user = {};
    if (loggedIn(req)) {
      user = req.session.passport.user;
      req.session.user = req.session.passport.user;
      req.session.tokenset = user.tokenset;
      res.render('index', { tokenset: user.tokenset })
    } else {
      res.render('index', { tokenset: {} })
    }
  });


  app.get('/claims', (req, res) => {
    if (loggedIn(req)) {
      const tokenset = req.session.passport.user.tokenset;
      res.write(`Bearer ${tokenset.access_token}`)
      axios.get(`https://${env}-api.va.gov/services/claims/v1/claims`, {
        headers: {
          Authorization: `Bearer ${tokenset.access_token}`
        }
      })
        .then(response => {
          res.render('claims', { claims: response.data.data, tokenset: tokenset });
        })
        .catch(error => {
          console.log(error)
        })
    } else {
      res.redirect('/auth'); // Redirect the user to login if they are not
    }
  });
  app.get('/status', verifyVeteranStatus);
  app.get('/disability_rating', verifyDisabilityRating);
  app.get('/service_history', verifyServiceHistory);
  app.get('/userdetails', userDetails);
  app.get('/logout', (req, res) => {
    req.logout();
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    })
  });
  app.get('/auth', passport.authenticate('oidc'));
  app.get('/auth/cb', wrapAuth);
  app.get('/jwt', getJWT);

  app.listen(port, () => console.log(`Example app listening on port ${port}!`));
}

(async () => {
  try {
    const oidcClient = await createClient();
    configurePassport(oidcClient);
    startApp(oidcClient);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
