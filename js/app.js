/* =========================================================
   VU NOTES — Shared Core Application Logic & Database Store
   Victoria University Uganda Student Resource Hub
   ========================================================= */

/* ---------- Faculty -> Course Mapping & Structured Courses ---------- */
const FACULTY_COURSES = {
  'Faculty of Science and Technology': [
    'Software Engineering',
    'Information and Communication Technology (ICT)',
    'Computer Science',
    'Business Computing and Data Analytics',
    'Cyber Security and Digital Forensics',
    'Artificial Intelligence and Data Science',
    'Visual Effects and Animation',
    'Agriculture and Rural Innovation',
    'Industrial Art and Innovative Design'
  ],
  'Faculty of Business and Management': [
    'Business Administration',
    'Business Administration - Accounting and Finance',
    'International Business',
    'Human Resource Management',
    'Procurement and Logistics Management',
    'Tourism and Hospitality Management',
    'Events and Hospitality Management',
    'Real Estate and Property Management',
    'Hotel Management and Culinary Art',
    'International Oil and Gas Management',
    'Energy Economics and Finance'
  ],
  'Faculty of Humanities and Social Sciences': [
    'Social Work and Social Administration',
    'Public Administration and Management',
    'Journalism and Media Studies',
    'International Relations and Diplomatic Studies',
    'Guidance and Counselling',
    'Music and Dance',
    'Film, TV Production and Digital Media'
  ],
  'School of Law': [
    'Legal Studies',
    'Bachelor of Laws (LLB)'
  ],
  'Faculty of Health Sciences': [
    'Nursing Science',
    'Midwifery Science',
    'Public Health',
    'Pharmacy Practice',
    'Human Nutrition and Dietetics'
  ],
  'Institute of Education and Life-Long Learning': [
    'Education (Arts)',
    'Education (Sciences)',
    'Early Childhood Education'
  ]
};

const DEFAULT_COURSES = [
  'General',
  ...Object.values(FACULTY_COURSES).flat()
];

/**
 * Helper to link Faculty -> Course dependent dropdowns across the application
 */
function populateCourseDropdown(facultySelectEl, courseSelectEl, options = {}) {
  if (!facultySelectEl || !courseSelectEl) return;

  const selectedFaculty = facultySelectEl.value;
  const allowAllWhenNoFaculty = options.allowAllWhenNoFaculty || false;
  const placeholderText = options.placeholderText || 'Select Course...';
  const allLabel = options.allLabel || 'All Courses';

  courseSelectEl.innerHTML = '';

  if (!selectedFaculty || selectedFaculty === '' || selectedFaculty === 'all' || selectedFaculty === 'All Faculties') {
    if (allowAllWhenNoFaculty) {
      courseSelectEl.disabled = false;
      let html = `<option value="all">${allLabel}</option>`;
      Object.keys(FACULTY_COURSES).forEach(fac => {
        html += `<optgroup label="${fac}">`;
        FACULTY_COURSES[fac].forEach(c => {
          html += `<option value="${c}">${c}</option>`;
        });
        html += `</optgroup>`;
      });
      courseSelectEl.innerHTML = html;
    } else {
      courseSelectEl.disabled = true;
      courseSelectEl.innerHTML = `<option value="">Select a faculty first</option>`;
    }
  } else {
    const courses = FACULTY_COURSES[selectedFaculty] || [];
    courseSelectEl.disabled = false;
    let html = options.includeAllOption ? `<option value="all">${allLabel}</option>` : `<option value="">${placeholderText}</option>`;
    courses.forEach(c => {
      html += `<option value="${c}">${c}</option>`;
    });
    courseSelectEl.innerHTML = html;
  }
}

/* ---------- Seeding Firestore Database ---------- */
async function seedIfNeeded() {
  if (!FIREBASE_READY || !db) return;
  try {
    const seedRef = db.collection('meta').doc('seed_v3');
    const seedDoc = await seedRef.get();
    if (seedDoc.exists) return;

    // Only administrators possess permission to write to /courses and /meta
    if (!_isAdminUser) return;

    const batch = db.batch();
    DEFAULT_COURSES.forEach(c => {
      const newDocRef = db.collection('courses').doc();
      batch.set(newDocRef, { name: c });
    });
    batch.set(seedRef, { done: true, seededAt: firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    console.log("Firestore course list seeded successfully by administrator.");
  } catch (e) {
    console.warn("Seeding check note:", e.message);
  }
}

/* ---------- Firebase Store Implementation ---------- */
const FirebaseStore = {
  watchTutors(cb) {
    if (!db) return () => {};
    return db.collection('tutors').orderBy('createdAt', 'desc').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.error('watchTutors error:', err);
      cb([]);
    });
  },

  watchCourses(cb) {
    if (!db) return () => {};
    return db.collection('courses').onSnapshot(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cb(list.length ? list : DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
    }, err => {
      console.error('watchCourses error:', err);
      cb(DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
    });
  },

  watchResources(cb) {
    if (!db) return () => {};
    return db.collection('resources').orderBy('createdAt', 'desc').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.error('watchResources error:', err);
      cb([]);
    });
  },

  async uploadStorageFile(file, path, customMetadata = {}) {
    if (!storage) throw new Error("Firebase Storage is not initialized.");
    // Ensure auth state has resolved so request.auth.uid strictly matches customMetadata.ownerId
    let uid = (currentUser && currentUser.uid) || (auth && auth.currentUser && auth.currentUser.uid);
    if (!uid && auth) {
      uid = await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(u => {
          if (u) { unsub(); resolve(u.uid); }
        });
        setTimeout(() => { unsub(); resolve(getCurrentUserId()); }, 1500);
      });
    }
    if (!uid) uid = getCurrentUserId();

    const ref = storage.ref().child(path);
    // Include ownerId in custom metadata so storage.rules can verify ownership
    const snap = await ref.put(file, { customMetadata: { ownerId: uid, ...customMetadata } });
    const downloadURL = await snap.ref.getDownloadURL();
    return { downloadURL, storagePath: path };
  },

  async addResource(r, file) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    let downloadURL = '', storagePath = '', fileName = '', fileSize = 0, fileType = '';

    if (file) {
      fileName = file.name;
      fileSize = file.size;
      fileType = file.type || 'application/octet-stream';
      const cleanCourse = (r.course || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanCat = (r.category || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timeStamp = Date.now();
      const path = `resources/${cleanCourse}/${cleanCat}/${timeStamp}-${file.name}`;
      
      const uploadRes = await FirebaseStore.uploadStorageFile(file, path);
      downloadURL = uploadRes.downloadURL;
      storagePath = uploadRes.storagePath;
    }

    // Security: Normal users always upload as 'Pending' — only admins can set 'Approved'
    // Never trust a client-supplied status for elevation; Firestore rules enforce this too
    const uploadStatus = _isAdminUser ? (r.status || 'Approved') : 'Pending';

    const docData = {
      title: r.title || fileName || 'Untitled Document',
      description: r.description || '',
      faculty: r.faculty || '',
      course: r.course || 'General',
      topic: r.topic || '',
      resourceType: r.resourceType || 'Notes/Document',
      mediaType: r.mediaType || 'document',
      category: r.category || 'lectures',
      status: uploadStatus,
      uploader: r.uploader || 'Anonymous Student',
      uploadedBy: r.uploader || 'Anonymous Student',
      ownerId: getCurrentUserId(),
      fileName: fileName,
      originalFileName: fileName,
      fileURL: downloadURL,
      downloadURL: downloadURL,
      storagePath: storagePath,
      fileSize: fileSize,
      fileType: fileType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      const docRef = await db.collection('resources').add(docData);
      return docRef.id;
    } catch (err) {
      if (storagePath && storage) {
        try { await storage.ref().child(storagePath).delete(); } catch(e){}
      }
      throw err;
    }
  },

  async updateResource(docId, updateData) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    await db.collection('resources').doc(docId).update({
      ...updateData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async moderateResource(docId, status, rejectionReason = '') {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    await FirebaseStore.updateResource(docId, {
      status: status,
      moderatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      moderatedBy: currentUser ? (currentUser.email || currentUser.uid) : 'Admin',
      moderationNotes: rejectionReason
    });
  },

  async deleteResource(id, storagePath, ownerId) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    const currentUid = getCurrentUserId();
    const isAdmin = typeof isAdminUser === 'function' && isAdminUser();
    if (!isAdmin && ownerId && ownerId !== currentUid) {
      throw new Error("You do not have permission to delete this resource.");
    }

    await db.collection('resources').doc(id).delete();

    if (storagePath && storage) {
      try {
        await storage.ref().child(storagePath).delete();
      } catch (err) {
        console.warn("Storage deletion note:", err.message);
      }
    }
  },

  async addTutor(t, photoFile) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    let photoURL = '', storagePath = '';
    
    if (photoFile) {
      const path = `tutor-photos/${Date.now()}-${photoFile.name}`;
      const uploadRes = await FirebaseStore.uploadStorageFile(photoFile, path);
      photoURL = uploadRes.downloadURL;
      storagePath = uploadRes.storagePath;
    }

    const tutorId = 'TUT-' + Math.floor(1000 + Math.random() * 9000);

    const docData = {
      id: tutorId,
      tutorId: tutorId,
      name: t.name,
      faculty: t.faculty || 'Faculty of Science and Technology',
      course: t.course || t.subject || 'General',
      subject: t.course || t.subject || 'General',
      phone: t.phone,
      email: t.email,
      bio: t.bio || '',
      availability: t.availability || 'Flexible',
      feeAmount: t.feeAmount || '',
      feeDuration: t.feeDuration || '1 Hour',
      photoURL: photoURL,
      storagePath: storagePath,
      ownerId: getCurrentUserId(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('tutors').add(docData);

    // Notify Admin
    await FirebaseStore.addNotification({
      type: 'TUTOR_REGISTERED',
      title: '🧑🏽‍🏫 NEW TUTOR REGISTERED',
      message: `Tutor: ${t.name} (ID: ${tutorId}) | Faculty: ${t.faculty} | Course: ${t.course || t.subject} | Fee: UGX ${t.feeAmount ? Number(t.feeAmount).toLocaleString() : 'Free'}`,
      tutorId: tutorId
    });

    return tutorId;
  },

  async updateTutor(id, t, photoFile, currentPhotoStoragePath) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    let photoURL = t.photoURL || '', storagePath = currentPhotoStoragePath || '';

    if (photoFile) {
      const path = `tutor-photos/${Date.now()}-${photoFile.name}`;
      const uploadRes = await FirebaseStore.uploadStorageFile(photoFile, path);
      photoURL = uploadRes.downloadURL;
      
      if (currentPhotoStoragePath && storage) {
        try { await storage.ref().child(currentPhotoStoragePath).delete(); } catch(e){}
      }
      storagePath = uploadRes.storagePath;
    }

    const updateData = {
      name: t.name,
      faculty: t.faculty || 'General',
      course: t.course || t.subject || 'General',
      subject: t.course || t.subject || 'General',
      phone: t.phone,
      email: t.email,
      bio: t.bio || '',
      availability: t.availability || 'Flexible',
      feeAmount: t.feeAmount || '',
      feeDuration: t.feeDuration || '1 Hour',
      photoURL: photoURL,
      storagePath: storagePath,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('tutors').doc(id).update(updateData);
  },

  async deleteTutor(id, photoStoragePath, ownerId) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    const currentUid = getCurrentUserId();
    if (ownerId && ownerId !== currentUid) {
      throw new Error("You do not have permission to delete this tutor profile.");
    }

    await db.collection('tutors').doc(id).delete();

    if (photoStoragePath && storage) {
      try {
        await storage.ref().child(photoStoragePath).delete();
      } catch (err) {
        console.warn("Tutor photo storage deletion note:", err.message);
      }
    }
  },

  async addCourse(name) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    const existing = await db.collection('courses').where('name', '==', name).get();
    if (existing.empty) {
      await db.collection('courses').add({ name });
    }
  },

  async watchBookings(cb) {
    if (!db) return () => {};
    return db.collection('bookings').orderBy('createdAt', 'desc').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.error('watchBookings error:', err);
      cb([]);
    });
  },

  async addBooking(b) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    const bookingId = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const settings = await FirebaseStore.getAdminSettings();
    const rate = settings.commissionRate || 10;
    const fee = Number(b.feeAmount || 0);
    const comm = Math.round((fee * rate) / 100);
    const earnings = Math.max(0, fee - comm);

    const docData = {
      id: bookingId,
      tutorId: b.tutorId,
      tutorName: b.tutorName,
      studentName: b.studentName,
      studentEmail: b.studentEmail,
      course: b.course || b.subject || 'General',
      date: b.date,
      time: b.time,
      duration: b.duration || '1 Hour',
      feeAmount: fee,
      sessionNote: b.sessionNote || '',
      bookingStatus: 'Pending',
      paymentStatus: 'Payment Pending',
      paymentVerificationType: 'Pending Verification',
      sessionStatus: 'Not Started',
      studentSessionConfirmed: false,
      tutorSessionConfirmed: false,
      commissionRate: rate,
      commissionAmount: comm,
      tutorEarnings: earnings,
      ownerId: getCurrentUserId(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('bookings').add(docData);

    // Notify Admin of new booking
    await FirebaseStore.addNotification({
      type: 'NEW_BOOKING',
      title: '🔔 NEW TUTOR BOOKING',
      message: `Student: ${b.studentName} | Tutor: ${b.tutorName} | Course: ${b.course || b.subject} | Date: ${b.date} ${b.time} | Status: Pending`,
      bookingId: bookingId
    });

    return bookingId;
  },

  async updateBooking(docId, updateData) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    // Use the Firestore document ID directly — do NOT query by field 'id'
    // bookingCache items already have { id: d.id, ...d.data() } where id IS the doc ID
    await db.collection('bookings').doc(docId).update({
      ...updateData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  watchNotifications(cb) {
    if (!db) return () => {};
    return db.collection('notifications').orderBy('createdAt', 'desc').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.error('watchNotifications error:', err);
      cb([]);
    });
  },

  async addNotification(n) {
    if (!FIREBASE_READY || !db) return;
    await db.collection('notifications').add({
      ...n,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async markNotificationRead(id) {
    if (!FIREBASE_READY || !db) return;
    await db.collection('notifications').doc(id).update({ read: true });
  },

  watchReviews(cb) {
    if (!db) return () => {};
    return db.collection('reviews').orderBy('createdAt', 'desc').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.error('watchReviews error:', err);
      cb([]);
    });
  },

  async addReview(r) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    await db.collection('reviews').add({
      ...r,
      reviewerId: getCurrentUserId(), // Required by Firestore rules to prevent impersonation
      flagged: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (r.bookingId) {
      await FirebaseStore.updateBooking(r.bookingId, { reviewSubmitted: true });
    }

    await FirebaseStore.addNotification({
      type: 'REVIEW_SUBMITTED',
      title: '⭐ NEW STUDENT REVIEW SUBMITTED',
      message: `Student ${r.studentName} rated Tutor ${r.tutorName} ${r.rating} stars: "${r.comment}"`,
      bookingId: r.bookingId
    });
  },

  async deleteReview(id) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    await db.collection('reviews').doc(id).delete();
  },

  async flagReview(id, flagged = true) {
    if (!FIREBASE_READY || !db) throw new Error("Firebase is not connected.");
    await db.collection('reviews').doc(id).update({ flagged });
  },

  async getAdminSettings() {
    if (!FIREBASE_READY || !db) return { commissionRate: 10 };
    const doc = await db.collection('settings').doc('admin').get();
    return doc.exists ? doc.data() : { commissionRate: 10 };
  },

  async saveAdminSettings(s) {
    if (!FIREBASE_READY || !db) return;
    await db.collection('settings').doc('admin').set(s, { merge: true });
  }
};

/* ---------- Local Store Implementation (Clean Slate & Real Data Only) ---------- */
const LOCAL_KEYS = {
  tutors: 'vu-tutors',
  courses: 'vu-courses',
  resources: 'vu-resources',
  bookings: 'vu-bookings',
  notifications: 'vu-notifications',
  reviews: 'vu-reviews',
  settings: 'vu-settings'
};
const localListeners = { tutors: [], courses: [], resources: [], bookings: [], notifications: [], reviews: [], settings: [] };

function localGet(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
function localSet(key, list) { localStorage.setItem(key, JSON.stringify(list)); }
function localNotify(kind) {
  if (localListeners[kind]) {
    localListeners[kind].forEach(cb => cb(localGet(LOCAL_KEYS[kind])));
  }
}

function seedLocalIfNeeded() {
  // Reset legacy hardcoded fake data once to start with clean real data
  if (!localStorage.getItem('vu_clean_v7')) {
    localStorage.removeItem(LOCAL_KEYS.tutors);
    localStorage.removeItem(LOCAL_KEYS.resources);
    localStorage.removeItem(LOCAL_KEYS.bookings);
    localStorage.removeItem(LOCAL_KEYS.notifications);
    localStorage.removeItem(LOCAL_KEYS.reviews);
    localStorage.setItem('vu_clean_v7', 'true');
  }

  const existingCourses = localStorage.getItem(LOCAL_KEYS.courses);
  if (!existingCourses) {
    localSet(LOCAL_KEYS.courses, DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
  }

  if (!localStorage.getItem(LOCAL_KEYS.tutors)) localSet(LOCAL_KEYS.tutors, []);
  if (!localStorage.getItem(LOCAL_KEYS.resources)) localSet(LOCAL_KEYS.resources, []);
  if (!localStorage.getItem(LOCAL_KEYS.bookings)) localSet(LOCAL_KEYS.bookings, []);
  if (!localStorage.getItem(LOCAL_KEYS.notifications)) localSet(LOCAL_KEYS.notifications, []);
  if (!localStorage.getItem(LOCAL_KEYS.reviews)) localSet(LOCAL_KEYS.reviews, []);
  if (!localStorage.getItem(LOCAL_KEYS.settings)) {
    localSet(LOCAL_KEYS.settings, { commissionRate: 10 });
  }
}

const LocalStore = {
  watchTutors(cb) { localListeners.tutors.push(cb); cb(localGet(LOCAL_KEYS.tutors)); return () => {}; },
  watchCourses(cb) {
    localListeners.courses.push(cb);
    const list = localGet(LOCAL_KEYS.courses);
    cb(list.length ? list : DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
    return () => {};
  },
  watchResources(cb) { localListeners.resources.push(cb); cb(localGet(LOCAL_KEYS.resources)); return () => {}; },
  watchBookings(cb) { localListeners.bookings.push(cb); cb(localGet(LOCAL_KEYS.bookings)); return () => {}; },
  watchNotifications(cb) { localListeners.notifications.push(cb); cb(localGet(LOCAL_KEYS.notifications)); return () => {}; },
  watchReviews(cb) { localListeners.reviews.push(cb); cb(localGet(LOCAL_KEYS.reviews)); return () => {}; },
  
  uploadStorageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ downloadURL: reader.result, storagePath: '' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async addResource(r, file) {
    let fileURL = '', fileName = '', fileSize = 0;
    if (file) {
      fileName = file.name; fileSize = file.size;
      const res = await LocalStore.uploadStorageFile(file);
      fileURL = res.downloadURL;
    }
    const list = localGet(LOCAL_KEYS.resources);
    // Security: Local mode also forces Pending for non-admins
    const uploadStatus = _isAdminUser ? (r.status || 'Approved') : 'Pending';
    const newDoc = {
      id: 'r_' + Date.now(),
      title: r.title || fileName || 'Untitled Document',
      description: r.description || '',
      faculty: r.faculty || '',
      course: r.course || 'General',
      topic: r.topic || '',
      resourceType: r.resourceType || 'Notes/Document',
      mediaType: r.mediaType || 'document',
      category: r.category || 'lectures',
      status: uploadStatus,
      uploader: r.uploader || 'Anonymous Student',
      uploadedBy: r.uploader || 'Anonymous Student',
      ownerId: getCurrentUserId(),
      fileURL, downloadURL: fileURL, fileName, originalFileName: fileName, fileSize,
      createdAt: new Date().toISOString()
    };
    list.unshift(newDoc);
    localSet(LOCAL_KEYS.resources, list);
    localNotify('resources');
    return newDoc.id;
  },

  async updateResource(id, updateData) {
    const list = localGet(LOCAL_KEYS.resources);
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updateData, updatedAt: new Date().toISOString() };
      localSet(LOCAL_KEYS.resources, list);
      localNotify('resources');
    }
  },

  async moderateResource(id, status, rejectionReason = '') {
    await LocalStore.updateResource(id, {
      status: status,
      moderationNotes: rejectionReason,
      moderatedAt: new Date().toISOString()
    });
  },

  async deleteResource(id) {
    let list = localGet(LOCAL_KEYS.resources);
    list = list.filter(item => item.id !== id);
    localSet(LOCAL_KEYS.resources, list);
    localNotify('resources');
  },

  async addTutor(t, photoFile) {
    let photoURL = '';
    if (photoFile) {
      const res = await LocalStore.uploadStorageFile(photoFile);
      photoURL = res.downloadURL;
    }
    const tutorId = 'TUT-' + Math.floor(1000 + Math.random() * 9000);
    const list = localGet(LOCAL_KEYS.tutors);
    const newTutor = {
      id: tutorId,
      tutorId: tutorId,
      name: t.name,
      faculty: t.faculty || 'Faculty of Science and Technology',
      course: t.course || t.subject || 'General',
      subject: t.course || t.subject || 'General',
      phone: t.phone,
      email: t.email,
      bio: t.bio || '',
      availability: t.availability || 'Flexible',
      feeAmount: t.feeAmount || '',
      feeDuration: t.feeDuration || '1 Hour',
      photoURL,
      ownerId: getCurrentUserId(),
      createdAt: new Date().toISOString()
    };
    list.unshift(newTutor);
    localSet(LOCAL_KEYS.tutors, list);
    localNotify('tutors');

    // Notify Admin of tutor registration
    await LocalStore.addNotification({
      type: 'TUTOR_REGISTERED',
      title: '🧑🏽‍🏫 NEW TUTOR REGISTERED',
      message: `Tutor: ${t.name} (ID: ${tutorId}) | Course: ${t.course || t.subject} | Fee: UGX ${t.feeAmount ? Number(t.feeAmount).toLocaleString() : 'Free'}`,
      tutorId: tutorId
    });

    return tutorId;
  },

  async updateTutor(id, t, photoFile) {
    let list = localGet(LOCAL_KEYS.tutors);
    const index = list.findIndex(x => x.id === id);
    if (index !== -1) {
      let photoURL = list[index].photoURL;
      if (photoFile) {
        const res = await LocalStore.uploadStorageFile(photoFile);
        photoURL = res.downloadURL;
      }
      list[index] = { ...list[index], ...t, photoURL, updatedAt: new Date().toISOString() };
      localSet(LOCAL_KEYS.tutors, list);
      localNotify('tutors');
    }
  },

  async deleteTutor(id) {
    let list = localGet(LOCAL_KEYS.tutors);
    list = list.filter(item => item.id !== id);
    localSet(LOCAL_KEYS.tutors, list);
    localNotify('tutors');
  },

  async addCourse(name) {
    const list = localGet(LOCAL_KEYS.courses);
    if (!list.find(c => c.name === name)) {
      list.push({ id: 'c_' + Date.now(), name });
      localSet(LOCAL_KEYS.courses, list);
      localNotify('courses');
    }
  },

  async addBooking(b) {
    const list = localGet(LOCAL_KEYS.bookings);
    const bookingId = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const settings = LocalStore.getAdminSettings();
    const rate = settings.commissionRate || 10;
    const fee = Number(b.feeAmount || 0);
    const comm = Math.round((fee * rate) / 100);
    const earnings = Math.max(0, fee - comm);

    const newBooking = {
      id: bookingId,
      ...b,
      bookingStatus: 'Pending',
      paymentStatus: 'Payment Pending',
      paymentVerificationType: 'Pending Verification',
      sessionStatus: 'Not Started',
      studentSessionConfirmed: false,
      tutorSessionConfirmed: false,
      commissionRate: rate,
      commissionAmount: comm,
      tutorEarnings: earnings,
      transactionRef: '',
      createdAt: new Date().toISOString()
    };
    list.unshift(newBooking);
    localSet(LOCAL_KEYS.bookings, list);
    localNotify('bookings');

    // Notify Admin of booking
    await LocalStore.addNotification({
      type: 'NEW_BOOKING',
      title: '🔔 NEW TUTOR BOOKING',
      message: `Student: ${b.studentName} | Tutor: ${b.tutorName} | Subject: ${b.course} | Date: ${b.date} ${b.time} | Fee: UGX ${fee.toLocaleString()} | Status: Pending`,
      bookingId: bookingId
    });

    return bookingId;
  },

  async updateBooking(id, updateData) {
    let list = localGet(LOCAL_KEYS.bookings);
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updateData, updatedAt: new Date().toISOString() };
      localSet(LOCAL_KEYS.bookings, list);
      localNotify('bookings');
    }
  },

  async addNotification(n) {
    const list = localGet(LOCAL_KEYS.notifications);
    list.unshift({ id: 'n_' + Date.now(), ...n, read: false, createdAt: new Date().toISOString() });
    localSet(LOCAL_KEYS.notifications, list);
    localNotify('notifications');
  },

  async markNotificationRead(id) {
    let list = localGet(LOCAL_KEYS.notifications);
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
      list[idx].read = true;
      localSet(LOCAL_KEYS.notifications, list);
      localNotify('notifications');
    }
  },

  async addReview(r) {
    const list = localGet(LOCAL_KEYS.reviews);
    const newRev = {
      id: 'rev_' + Date.now(),
      ...r,
      flagged: false,
      createdAt: new Date().toISOString()
    };
    list.unshift(newRev);
    localSet(LOCAL_KEYS.reviews, list);
    localNotify('reviews');

    // Mark reviewSubmitted on booking
    if (r.bookingId) {
      await LocalStore.updateBooking(r.bookingId, { reviewSubmitted: true });
    }

    // Notify admin
    await LocalStore.addNotification({
      type: 'REVIEW_SUBMITTED',
      title: '⭐ NEW STUDENT REVIEW SUBMITTED',
      message: `Student ${r.studentName} gave ${r.rating} stars for Tutor ${r.tutorName}: "${r.comment}"`,
      bookingId: r.bookingId
    });
  },

  async deleteReview(id) {
    let list = localGet(LOCAL_KEYS.reviews);
    list = list.filter(x => x.id !== id);
    localSet(LOCAL_KEYS.reviews, list);
    localNotify('reviews');
  },

  async flagReview(id, flagged = true) {
    let list = localGet(LOCAL_KEYS.reviews);
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
      list[idx].flagged = flagged;
      localSet(LOCAL_KEYS.reviews, list);
      localNotify('reviews');
    }
  },

  getAdminSettings() {
    return JSON.parse(localStorage.getItem(LOCAL_KEYS.settings) || '{"commissionRate":10}');
  },

  saveAdminSettings(s) {
    localStorage.setItem(LOCAL_KEYS.settings, JSON.stringify(s));
    localNotify('settings');

    // Recalculate pending/confirmed booking commissions
    let list = localGet(LOCAL_KEYS.bookings);
    const rate = Number(s.commissionRate || 10);
    list = list.map(b => {
      const fee = Number(b.feeAmount || 0);
      const comm = Math.round((fee * rate) / 100);
      const earnings = Math.max(0, fee - comm);
      return { ...b, commissionRate: rate, commissionAmount: comm, tutorEarnings: earnings };
    });
    localSet(LOCAL_KEYS.bookings, list);
    localNotify('bookings');
  }
};

if (!FIREBASE_READY) seedLocalIfNeeded();

// Primary store selection: Uses FirebaseStore if configured, else LocalStore
const STORE = FIREBASE_READY ? FirebaseStore : LocalStore;

/* ---------- Setup Banner Render ---------- */
function renderSetupBanner() {
  if (FIREBASE_READY) return;
  const banner = document.createElement('div');
  banner.className = 'setup-banner';
  banner.innerHTML = 'Running in preview mode — uploads are saved locally. Connect your Firebase credentials in <code>js/firebase-config.js</code> to share them live with every student across all devices.';
  document.body.prepend(banner);
}

/* ---------- Shared UI Utilities ---------- */
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<span class="dot"></span><span class="msg"></span>';
    document.body.appendChild(toast);
  }
  toast.querySelector('.msg').textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

function initials(name) {
  if (!name) return 'VU';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function timeAgo(iso) {
  if (!iso) return 'just now';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'recently';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

function fileSizeLabel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ---------- Global Event Listeners & Nav Initialization ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderSetupBanner();

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // Highlight active nav tab
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === here || (here === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Modal overlay click to close
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => {
        m.classList.remove('open');
        document.body.style.overflow = '';
      });
    }
  });
});
