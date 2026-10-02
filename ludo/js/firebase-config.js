// Online play needs a free Firebase Realtime Database — see ludo/README.md.
// Paste the config from Firebase console → Project settings → Your apps → Web app.
// Only `databaseURL` is really required. This is safe to be public: the
// database rules (ludo/database.rules.json) decide what anyone can do.
//
// Example:
// export const firebaseConfig = {
//   apiKey: 'AIza…',
//   authDomain: 'alquida-landu.firebaseapp.com',
//   databaseURL: 'https://alquida-landu-default-rtdb.asia-southeast1.firebasedatabase.app',
//   projectId: 'alquida-landu',
//   appId: '1:123:web:abc',
// };

export const firebaseConfig = {
  databaseURL: 'https://ludo-d689b-default-rtdb.asia-southeast1.firebasedatabase.app',
};
