import { firestore, ts } from './firebase.js';

const snap = (d) => ({ id: d.id, ...d.data() });

export async function getDoc(coll, id) {
  const s = await firestore.collection(coll).doc(String(id)).get();
  return s.exists ? snap(s) : null;
}

export async function listColl(coll) {
  const snap = await firestore.collection(coll).get();
  return snap.docs.map(snap);
}

export async function whereEq(coll, field, value) {
  const snap = await firestore.collection(coll).where(field, '==', value).get();
  return snap.docs.map(snap);
}

export async function createDoc(coll, data) {
  const ref = firestore.collection(coll).doc();
  await ref.set({ ...data, created_at: data.created_at || ts() });
  return ref.id;
}

export async function setDoc(coll, id, data) {
  await firestore.collection(coll).doc(String(id)).set(data);
  return String(id);
}

export async function updateDoc(coll, id, updates) {
  await firestore.collection(coll).doc(String(id)).update(updates);
}

export async function deleteDoc(coll, id) {
  await firestore.collection(coll).doc(String(id)).delete();
}

export async function listSub(coll, id, sub) {
  const snap = await firestore.collection(coll).doc(String(id)).collection(sub).get();
  return snap.docs.map(snap);
}

// Envoltorio para handlers async: captura errores y responde 500 (Express 4 no los captura solo).
export function h(fn) {
  return (req, res, _next) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
    });
  };
}

export async function userMap() {
  const users = await listColl('users');
  return Object.fromEntries(users.map((u) => [String(u.id), u]));
}

export async function categoryMap() {
  const cats = await listColl('categories');
  return Object.fromEntries(cats.map((c) => [String(c.id), c]));
}

export async function productMap() {
  const products = await listColl('products');
  return Object.fromEntries(products.map((p) => [String(p.id), p]));
}

export { firestore, ts };