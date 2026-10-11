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



/* ---------- Supabase Store Implementation ---------- */
function mapSupabaseResource(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title || 'Untitled Document',
    description: r.description || '',
    faculty: r.faculty || '',
    course: r.course || 'General',
    topic: r.topic || '',
    resourceType: r.resource_type || 'Notes/Document',
    mediaType: r.media_type || 'document',
    category: r.category || 'lectures',
    status: r.status || 'Pending',
    uploader: r.uploader || r.uploaded_by || 'Anonymous Student',
    uploadedBy: r.uploaded_by || r.uploader || 'Anonymous Student',
    ownerId: r.owner_id,
    fileName: r.file_name || '',
    originalFileName: r.original_file_name || r.file_name || '',
    fileURL: r.file_url || r.download_url || '',
    downloadURL: r.download_url || r.file_url || '',
    storagePath: r.storage_path || '',
    fileSize: Number(r.file_size || 0),
    fileType: r.file_type || '',
    moderationNotes: r.moderation_notes || '',
    moderatedBy: r.moderated_by || '',
    moderatedAt: r.moderated_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function mapSupabaseTutor(t) {
  if (!t) return null;
  return {
    id: t.id || t.tutor_id,
    tutorId: t.tutor_id || t.id,
    name: t.name,
    faculty: t.faculty || 'Faculty of Science and Technology',
    course: t.course || t.subject || 'General',
    subject: t.subject || t.course || 'General',
    phone: t.phone || '',
    email: t.email || '',
    bio: t.bio || '',
    availability: t.availability || 'Flexible',
    feeAmount: t.fee_amount || '',
    feeDuration: t.fee_duration || '1 Hour',
    photoURL: t.photo_url || '',
    storagePath: t.storage_path || '',
    ownerId: t.owner_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
}

function mapSupabaseBooking(b) {
  if (!b) return null;
  return {
    id: b.id,
    tutorId: b.tutor_id,
    tutorName: b.tutor_name,
    studentName: b.student_name,
    studentEmail: b.student_email,
    course: b.course || 'General',
    date: b.date,
    time: b.time,
    duration: b.duration || '1 Hour',
    sessionNote: b.session_note || '',
    note: b.session_note || '',
    bookingStatus: b.booking_status || 'Pending',
    paymentStatus: b.payment_status || 'Payment Pending',
    paymentVerificationType: b.payment_verification_type || 'Pending Verification',
    transactionRef: b.transaction_ref || '',
    sessionStatus: b.session_status || 'Not Started',
    studentSessionConfirmed: !!b.student_session_confirmed,
    tutorSessionConfirmed: !!b.tutor_session_confirmed,
    reviewSubmitted: !!b.review_submitted,
    commissionRate: Number(b.commission_rate || 10),
    commissionAmount: Number(b.commission_amount || 0),
    tutorEarnings: Number(b.tutor_earnings || 0),
    paymentVerifiedBy: b.payment_verified_by || '',
    paymentVerifiedAt: b.payment_verified_at,
    ownerId: b.owner_id,
    createdAt: b.created_at,
    updatedAt: b.updated_at
  };
}

function mapSupabaseReview(r) {
  if (!r) return null;
  return {
    id: r.id,
    bookingId: r.booking_id || '',
    tutorId: r.tutor_id || '',
    tutorName: r.tutor_name || '',
    studentName: r.student_name || '',
    rating: Number(r.rating || 5),
    comment: r.comment || '',
    flagged: !!r.flagged,
    reviewerId: r.reviewer_id,
    createdAt: r.created_at
  };
}

function mapSupabaseNotification(n) {
  if (!n) return null;
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    bookingId: n.booking_id || '',
    tutorId: n.tutor_id || '',
    read: !!n.read,
    createdAt: n.created_at
  };
}

const SupabaseStore = {
  watchTutors(cb) {
    if (!SUPABASE_READY || !supabaseClient) { cb([]); return () => {}; }

    async function fetchTutors() {
      try {
        const { data, error } = await supabaseClient
          .from('tutors')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Supabase watchTutors error:', error);
          cb([]);
        } else {
          cb((data || []).map(mapSupabaseTutor));
        }
      } catch (err) {
        console.error('Supabase watchTutors error:', err);
        cb([]);
      }
    }

    fetchTutors();

    const channel = supabaseClient
      .channel('public:tutors_feed_' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutors' }, () => {
        fetchTutors();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  watchCourses(cb) {
    if (!SUPABASE_READY || !supabaseClient) {
      cb(DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
      return () => {};
    }

    async function fetchCourses() {
      try {
        const { data, error } = await supabaseClient
          .from('courses')
          .select('*')
          .order('name', { ascending: true });
        if (error || !data || !data.length) {
          cb(DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
        } else {
          cb(data);
        }
      } catch (err) {
        console.error('Supabase watchCourses error:', err);
        cb(DEFAULT_COURSES.map((name, i) => ({ id: 'c_' + i, name })));
      }
    }

    fetchCourses();

    const channel = supabaseClient
      .channel('public:courses_feed_' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchCourses();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  watchResources(cb) {
    if (!SUPABASE_READY || !supabaseClient) { cb([]); return () => {}; }

    async function fetchResources() {
      try {
        const { data, error } = await supabaseClient
          .from('resources')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Supabase watchResources error:', error);
          cb([]);
        } else {
          cb((data || []).map(mapSupabaseResource));
        }
      } catch (err) {
        console.error('Supabase watchResources error:', err);
        cb([]);
      }
    }

    fetchResources();

    const channel = supabaseClient
      .channel('public:resources_feed_' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => {
        fetchResources();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  async uploadStorageFile(file, bucket, path) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not initialized.");
    
    // Normalize and resolve MIME type based on file extension
    let contentType = file.type || '';
    const ext = (file.name || path).split('.').pop().toLowerCase();
    const mimeMap = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'heic': 'image/heic',
      'heif': 'image/heif', 'avif': 'image/avif', 'svg': 'image/svg+xml',
      'pdf': 'application/pdf', 'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain', 'csv': 'text/csv'
    };
    if (!contentType || contentType === 'application/octet-stream') {
      contentType = mimeMap[ext] || 'application/octet-stream';
    }

    const { data, error } = await supabaseClient.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      contentType: contentType,
      upsert: true
    });
    if (error) {
      console.error('Storage upload error details:', error);
      throw new Error('Supabase Storage upload failed: ' + error.message);
    }
    const { data: pubData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    return {
      downloadURL: pubData ? pubData.publicUrl : '',
      storagePath: path
    };
  },

  async addResource(r, file) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    let downloadURL = '', storagePath = '', fileName = '', fileSize = 0, fileType = '';

    if (file) {
      fileName = file.name;
      fileSize = file.size;
      fileType = file.type || 'application/octet-stream';
      const cleanCourse = (r.course || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanCat = (r.category || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timeStamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${cleanCourse}/${cleanCat}/${timeStamp}-${safeName}`;

      const uploadRes = await SupabaseStore.uploadStorageFile(file, 'resources', path);
      downloadURL = uploadRes.downloadURL;
      storagePath = uploadRes.storagePath;
    }

    const isAdmin = typeof isAdminUser === 'function' && isAdminUser();
    const uploadStatus = isAdmin ? (r.status || 'Approved') : 'Pending';

    const insertData = {
      title: r.title || fileName || 'Untitled Document',
      description: r.description || '',
      faculty: r.faculty || '',
      course: r.course || 'General',
      topic: r.topic || '',
      resource_type: r.resourceType || 'Notes/Document',
      media_type: r.mediaType || 'document',
      category: r.category || 'lectures',
      status: uploadStatus,
      uploader: r.uploader || 'Anonymous Student',
      uploaded_by: r.uploader || 'Anonymous Student',
      owner_id: getCurrentUserId(),
      file_name: fileName,
      original_file_name: fileName,
      file_url: downloadURL,
      download_url: downloadURL,
      storage_path: storagePath,
      file_size: fileSize,
      file_type: fileType
    };

    const { data, error } = await supabaseClient.from('resources').insert([insertData]).select();
    if (error) {
      if (storagePath) {
        try { await supabaseClient.storage.from('resources').remove([storagePath]); } catch (e) {}
      }
      throw new Error(error.message);
    }
    return data && data[0] ? data[0].id : null;
  },

  async updateResource(docId, updateData) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const mapped = {};
    if ('title' in updateData) mapped.title = updateData.title;
    if ('description' in updateData) mapped.description = updateData.description;
    if ('faculty' in updateData) mapped.faculty = updateData.faculty;
    if ('course' in updateData) mapped.course = updateData.course;
    if ('topic' in updateData) mapped.topic = updateData.topic;
    if ('status' in updateData) mapped.status = updateData.status;
    if ('category' in updateData) mapped.category = updateData.category;
    if ('resourceType' in updateData) mapped.resource_type = updateData.resourceType;
    if ('mediaType' in updateData) mapped.media_type = updateData.mediaType;
    if ('moderationNotes' in updateData) mapped.moderation_notes = updateData.moderationNotes;
    if ('moderatedBy' in updateData) mapped.moderated_by = updateData.moderatedBy;
    if ('moderatedAt' in updateData) mapped.moderated_at = updateData.moderatedAt;
    mapped.updated_at = new Date().toISOString();

    const { error } = await supabaseClient.from('resources').update(mapped).eq('id', docId);
    if (error) throw new Error(error.message);
  },

  async moderateResource(docId, status, rejectionReason = '') {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const user = typeof _supabaseCurrentUser !== 'undefined' ? _supabaseCurrentUser : null;
    const modBy = user ? (user.email || user.id) : 'Admin';
    await SupabaseStore.updateResource(docId, {
      status: status,
      moderatedAt: new Date().toISOString(),
      moderatedBy: modBy,
      moderationNotes: rejectionReason
    });
  },

  async deleteResource(id, storagePath, ownerId) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const currentUid = getCurrentUserId();
    const isAdmin = typeof isAdminUser === 'function' && isAdminUser();
    if (!isAdmin && ownerId && ownerId !== currentUid) {
      throw new Error("You do not have permission to delete this resource.");
    }

    const { error } = await supabaseClient.from('resources').delete().eq('id', id);
    if (error) throw new Error(error.message);

    if (storagePath) {
      try {
        await supabaseClient.storage.from('resources').remove([storagePath]);
      } catch (err) {
        console.warn("Storage deletion note:", err.message);
      }
    }
  },

  async addTutor(t, photoFile) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    let photoURL = '', storagePath = '';

    if (photoFile) {
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${Date.now()}-${safeName}`;
      const uploadRes = await SupabaseStore.uploadStorageFile(photoFile, 'tutor-photos', path);
      photoURL = uploadRes.downloadURL;
      storagePath = uploadRes.storagePath;
    }

    const tutorId = 'TUT-' + Math.floor(1000 + Math.random() * 9000);

    const rowData = {
      id: tutorId,
      tutor_id: tutorId,
      name: t.name,
      faculty: t.faculty || 'Faculty of Science and Technology',
      course: t.course || t.subject || 'General',
      subject: t.course || t.subject || 'General',
      phone: t.phone || '',
      email: t.email || '',
      bio: t.bio || '',
      availability: t.availability || 'Flexible',
      fee_amount: String(t.feeAmount || ''),
      fee_duration: t.feeDuration || '1 Hour',
      photo_url: photoURL,
      storage_path: storagePath,
      owner_id: getCurrentUserId()
    };

    const { error } = await supabaseClient.from('tutors').insert([rowData]);
    if (error) {
      if (storagePath) {
        try { await supabaseClient.storage.from('tutor-photos').remove([storagePath]); } catch (e) {}
      }
      throw new Error(error.message);
    }

    // Notify Admin
    await SupabaseStore.addNotification({
      type: 'TUTOR_REGISTERED',
      title: '🧑🏽‍🏫 NEW TUTOR REGISTERED',
      message: `Tutor: ${t.name} (ID: ${tutorId}) | Faculty: ${t.faculty} | Course: ${t.course || t.subject} | Fee: UGX ${t.feeAmount ? Number(t.feeAmount).toLocaleString() : 'Free'}`,
      tutorId: tutorId
    });

    return tutorId;
  },

  async updateTutor(id, t, photoFile, currentPhotoStoragePath) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    let photoURL = t.photoURL || '', storagePath = currentPhotoStoragePath || '';

    if (photoFile) {
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${Date.now()}-${safeName}`;
      const uploadRes = await SupabaseStore.uploadStorageFile(photoFile, 'tutor-photos', path);
      photoURL = uploadRes.downloadURL;

      if (currentPhotoStoragePath) {
        try { await supabaseClient.storage.from('tutor-photos').remove([currentPhotoStoragePath]); } catch (e) {}
      }
      storagePath = uploadRes.storagePath;
    }

    const updateData = {
      name: t.name,
      faculty: t.faculty || 'General',
      course: t.course || t.subject || 'General',
      subject: t.course || t.subject || 'General',
      phone: t.phone || '',
      email: t.email || '',
      bio: t.bio || '',
      availability: t.availability || 'Flexible',
      fee_amount: String(t.feeAmount || ''),
      fee_duration: t.feeDuration || '1 Hour',
      photo_url: photoURL,
      storage_path: storagePath,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('tutors').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteTutor(id, photoStoragePath, ownerId) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const currentUid = getCurrentUserId();
    const isAdmin = typeof isAdminUser === 'function' && isAdminUser();
    if (!isAdmin && ownerId && ownerId !== currentUid) {
      throw new Error("You do not have permission to delete this tutor profile.");
    }

    const { error } = await supabaseClient.from('tutors').delete().eq('id', id);
    if (error) throw new Error(error.message);

    if (photoStoragePath) {
      try {
        await supabaseClient.storage.from('tutor-photos').remove([photoStoragePath]);
      } catch (err) {
        console.warn("Tutor photo storage deletion note:", err.message);
      }
    }
  },

  async addCourse(name) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const { error } = await supabaseClient.from('courses').insert([{ name }]);
    if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
      throw new Error(error.message);
    }
  },

  watchBookings(cb) {
    if (!SUPABASE_READY || !supabaseClient) { cb([]); return () => {}; }

    async function fetchBookings() {
      try {
        const { data, error } = await supabaseClient
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Supabase watchBookings error:', error);
          cb([]);
        } else {
          cb((data || []).map(mapSupabaseBooking));
        }
      } catch (err) {
        console.error('Supabase watchBookings error:', err);
        cb([]);
      }
    }

    fetchBookings();

    const channel = supabaseClient
      .channel('public:bookings_feed_' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  async addBooking(b) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const bookingId = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const settings = await SupabaseStore.getAdminSettings();
    const rate = Number(settings.commissionRate || 10);
    const fee = Number(b.feeAmount || 0);
    const comm = Math.round((fee * rate) / 100);
    const earnings = Math.max(0, fee - comm);

    const rowData = {
      id: bookingId,
      tutor_id: b.tutorId || '',
      tutor_name: b.tutorName || '',
      student_name: b.studentName || '',
      student_email: b.studentEmail || '',
      course: b.course || b.subject || 'General',
      date: b.date || '',
      time: b.time || '',
      duration: b.duration || '1 Hour',
      fee_amount: fee,
      session_note: b.sessionNote || b.note || '',
      booking_status: 'Pending',
      payment_status: 'Payment Pending',
      payment_verification_type: 'Pending Verification',
      session_status: 'Not Started',
      student_session_confirmed: false,
      tutor_session_confirmed: false,
      commission_rate: rate,
      commission_amount: comm,
      tutor_earnings: earnings,
      owner_id: getCurrentUserId()
    };

    const { error } = await supabaseClient.from('bookings').insert([rowData]);
    if (error) throw new Error(error.message);

    // Notify Admin of new booking
    await SupabaseStore.addNotification({
      type: 'NEW_BOOKING',
      title: '🔔 NEW TUTOR BOOKING',
      message: `Student: ${b.studentName} | Tutor: ${b.tutorName} | Course: ${b.course || b.subject} | Date: ${b.date} ${b.time} | Status: Pending`,
      bookingId: bookingId
    });

    return bookingId;
  },

  async updateBooking(docId, updateData) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const mapped = {};
    if ('tutorName' in updateData) mapped.tutor_name = updateData.tutorName;
    if ('studentName' in updateData) mapped.student_name = updateData.studentName;
    if ('studentEmail' in updateData) mapped.student_email = updateData.studentEmail;
    if ('date' in updateData) mapped.date = updateData.date;
    if ('time' in updateData) mapped.time = updateData.time;
    if ('feeAmount' in updateData) mapped.fee_amount = Number(updateData.feeAmount);
    if ('sessionNote' in updateData) mapped.session_note = updateData.sessionNote;
    if ('bookingStatus' in updateData) mapped.booking_status = updateData.bookingStatus;
    if ('paymentStatus' in updateData) mapped.payment_status = updateData.paymentStatus;
    if ('paymentVerificationType' in updateData) mapped.payment_verification_type = updateData.paymentVerificationType;
    if ('transactionRef' in updateData) mapped.transaction_ref = updateData.transactionRef;
    if ('sessionStatus' in updateData) mapped.session_status = updateData.sessionStatus;
    if ('studentSessionConfirmed' in updateData) mapped.student_session_confirmed = updateData.studentSessionConfirmed;
    if ('tutorSessionConfirmed' in updateData) mapped.tutor_session_confirmed = updateData.tutorSessionConfirmed;
    if ('reviewSubmitted' in updateData) mapped.review_submitted = updateData.reviewSubmitted;
    if ('commissionRate' in updateData) mapped.commission_rate = Number(updateData.commissionRate);
    if ('commissionAmount' in updateData) mapped.commission_amount = Number(updateData.commissionAmount);
    if ('tutorEarnings' in updateData) mapped.tutor_earnings = Number(updateData.tutorEarnings);
    if ('paymentVerifiedBy' in updateData) mapped.payment_verified_by = updateData.paymentVerifiedBy;
    if ('paymentVerifiedAt' in updateData) mapped.payment_verified_at = updateData.paymentVerifiedAt;
    mapped.updated_at = new Date().toISOString();

    const { error } = await supabaseClient.from('bookings').update(mapped).eq('id', docId);
    if (error) throw new Error(error.message);
  },

  watchNotifications(cb) {
    if (!SUPABASE_READY || !supabaseClient) { cb([]); return () => {}; }

    async function fetchNotifications() {
      try {
        const { data, error } = await supabaseClient
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Supabase watchNotifications error:', error);
          cb([]);
        } else {
          cb((data || []).map(mapSupabaseNotification));
        }
      } catch (err) {
        console.error('Supabase watchNotifications error:', err);
        cb([]);
      }
    }

    fetchNotifications();

    const channel = supabaseClient
      .channel('public:notifications_feed_' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  async addNotification(n) {
    if (!SUPABASE_READY || !supabaseClient) return;
    const row = {
      type: n.type || 'SYSTEM',
      title: n.title || 'Notification',
      message: n.message || '',
      booking_id: n.bookingId || '',
      tutor_id: n.tutorId || '',
      read: false
    };
    await supabaseClient.from('notifications').insert([row]);
  },

  async markNotificationRead(id) {
    if (!SUPABASE_READY || !supabaseClient) return;
    await supabaseClient.from('notifications').update({ read: true }).eq('id', id);
  },

  watchReviews(cb) {
    if (!SUPABASE_READY || !supabaseClient) { cb([]); return () => {}; }

    async function fetchReviews() {
      try {
        const { data, error } = await supabaseClient
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Supabase watchReviews error:', error);
          cb([]);
        } else {
          cb((data || []).map(mapSupabaseReview));
        }
      } catch (err) {
        console.error('Supabase watchReviews error:', err);
        cb([]);
      }
    }

    fetchReviews();

    const channel = supabaseClient
      .channel('public:reviews_feed_' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        fetchReviews();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  async addReview(r) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const row = {
      booking_id: r.bookingId || '',
      tutor_id: r.tutorId || '',
      tutor_name: r.tutorName || '',
      student_name: r.studentName || '',
      rating: Number(r.rating || 5),
      comment: r.comment || '',
      flagged: false,
      reviewer_id: getCurrentUserId()
    };

    const { error } = await supabaseClient.from('reviews').insert([row]);
    if (error) throw new Error(error.message);

    if (r.bookingId) {
      await SupabaseStore.updateBooking(r.bookingId, { reviewSubmitted: true });
    }

    await SupabaseStore.addNotification({
      type: 'REVIEW_SUBMITTED',
      title: '⭐ NEW STUDENT REVIEW SUBMITTED',
      message: `Student ${r.studentName} rated Tutor ${r.tutorName} ${r.rating} stars: "${r.comment}"`,
      bookingId: r.bookingId
    });
  },

  async deleteReview(id) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async flagReview(id, flagged = true) {
    if (!SUPABASE_READY || !supabaseClient) throw new Error("Supabase is not connected.");
    const { error } = await supabaseClient.from('reviews').update({ flagged }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getAdminSettings() {
    if (!SUPABASE_READY || !supabaseClient) return { commissionRate: 10 };
    const { data, error } = await supabaseClient.from('settings').select('value').eq('key', 'admin').maybeSingle();
    if (error || !data || !data.value) return { commissionRate: 10 };
    return data.value;
  },

  async saveAdminSettings(s) {
    if (!SUPABASE_READY || !supabaseClient) return;
    await supabaseClient.from('settings').upsert({
      key: 'admin',
      value: s,
      updated_at: new Date().toISOString()
    });
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

const IS_BACKEND_READY = typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY;

if (!IS_BACKEND_READY) seedLocalIfNeeded();

// Primary store selection: Uses SupabaseStore if configured, else LocalStore (offline preview)
const STORE = IS_BACKEND_READY ? SupabaseStore : LocalStore;

/* ---------- Setup Banner Render ---------- */
function renderSetupBanner() {
  if (IS_BACKEND_READY) return;
  const banner = document.createElement('div');
  banner.className = 'setup-banner';
  banner.innerHTML = 'Running in preview mode — uploads and bookings are saved locally. Connect your Supabase credentials in <code>js/supabase-config.js</code> to share them live with every student across all devices.';
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
