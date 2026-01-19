const { useState, useEffect } = React;

// Composant principal
function AdminCahierTextes() {
    const [currentView, setCurrentView] = useState('dashboard');
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Vérifier l'authentification et les droits admin
    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                
                // Vérifier si l'utilisateur est admin
                try {
                    const userDoc = await firebase.firestore()
                        .collection('users')
                        .doc(currentUser.uid)
                        .get();
                    
                    if (userDoc.exists && userDoc.data().role === 'admin') {
                        setIsAdmin(true);
                        loadData();
                    } else {
                        alert('Accès refusé. Vous devez être administrateur.');
                        window.location.href = '/premium.html';
                    }
                } catch (error) {
                    console.error('Erreur vérification admin:', error);
                    window.location.href = '/premium.html';
                }
            } else {
                window.location.href = '/auth.html';
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Charger toutes les données
    const loadData = async () => {
        try {
            const db = firebase.firestore();
            
            // Charger les classes
            const classesSnapshot = await db.collection('classes').get();
            setClasses(classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            // Charger les élèves
            const studentsSnapshot = await db.collection('students').get();
            setStudents(studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            // Charger les matières
            const subjectsSnapshot = await db.collection('subjects').get();
            setSubjects(subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            // Charger les devoirs
            const assignmentsSnapshot = await db.collection('assignments').get();
            setAssignments(assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            // Charger les séances
            const sessionsSnapshot = await db.collection('sessions').get();
            setSessions(sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
        } catch (error) {
            console.error('Erreur chargement données:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div>Chargement...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
            {/* Header */}
            <header style={{
                backgroundColor: '#2c5f2d',
                color: 'white',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>
                        📚 Administration Cahier de Textes
                    </h1>
                    <p style={{ margin: '5px 0 0', opacity: 0.9 }}>
                        PedaClic - Panneau d'administration
                    </p>
                </div>
            </header>

            <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px' }}>
                {/* Navigation */}
                <nav style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap'
                }}>
                    {[
                        { id: 'dashboard', label: '📊 Tableau de bord' },
                        { id: 'classes', label: '🏫 Classes' },
                        { id: 'students', label: '👨‍🎓 Élèves' },
                        { id: 'subjects', label: '📖 Matières' },
                        { id: 'assignments', label: '📝 Devoirs' },
                        { id: 'sessions', label: '📅 Séances' }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: currentView === item.id ? '#2c5f2d' : '#f0f0f0',
                                color: currentView === item.id ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: currentView === item.id ? 'bold' : 'normal',
                                transition: 'all 0.3s'
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Contenu principal */}
                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {currentView === 'dashboard' && (
                        <Dashboard 
                            classes={classes}
                            students={students}
                            assignments={assignments}
                            sessions={sessions}
                        />
                    )}
                    {currentView === 'classes' && (
                        <ClassesManager 
                            classes={classes}
                            setClasses={setClasses}
                            students={students}
                        />
                    )}
                    {currentView === 'students' && (
                        <StudentsManager 
                            students={students}
                            setStudents={setStudents}
                            classes={classes}
                        />
                    )}
                    {currentView === 'subjects' && (
                        <SubjectsManager 
                            subjects={subjects}
                            setSubjects={setSubjects}
                        />
                    )}
                    {currentView === 'assignments' && (
                        <AssignmentsManager 
                            assignments={assignments}
                            setAssignments={setAssignments}
                            classes={classes}
                            subjects={subjects}
                        />
                    )}
                    {currentView === 'sessions' && (
                        <SessionsManager 
                            sessions={sessions}
                            setSessions={setSessions}
                            classes={classes}
                            subjects={subjects}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Tableau de bord
function Dashboard({ classes, students, assignments, sessions }) {
    const stats = [
        { label: 'Classes', value: classes.length, icon: '🏫', color: '#4CAF50' },
        { label: 'Élèves', value: students.length, icon: '👨‍🎓', color: '#2196F3' },
        { label: 'Devoirs', value: assignments.length, icon: '📝', color: '#FF9800' },
        { label: 'Séances', value: sessions.length, icon: '📅', color: '#9C27B0' }
    ];

    return (
        <div>
            <h2 style={{ marginTop: 0, color: '#2c5f2d' }}>Tableau de bord</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px' }}>
                {stats.map(stat => (
                    <div key={stat.label} style={{
                        backgroundColor: stat.color,
                        color: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>{stat.icon}</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stat.value}</div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Activité récente */}
            <div style={{ marginTop: '40px' }}>
                <h3 style={{ color: '#333' }}>📊 Statistiques par classe</h3>
                <div style={{ marginTop: '20px' }}>
                    {classes.map(classe => {
                        const classStudents = students.filter(s => s.classId === classe.id);
                        const classAssignments = assignments.filter(a => a.classId === classe.id);
                        
                        return (
                            <div key={classe.id} style={{
                                padding: '15px',
                                backgroundColor: '#f9f9f9',
                                borderRadius: '6px',
                                marginBottom: '10px',
                                border: '1px solid #ddd'
                            }}>
                                <div style={{ fontWeight: 'bold', color: '#2c5f2d', marginBottom: '8px' }}>
                                    {classe.name}
                                </div>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                    {classStudents.length} élèves • {classAssignments.length} devoirs
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Gestion des classes
function ClassesManager({ classes, setClasses, students }) {
    const [showForm, setShowForm] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({ name: '', level: '', year: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        
        try {
            if (editingClass) {
                await db.collection('classes').doc(editingClass.id).update(formData);
                setClasses(classes.map(c => c.id === editingClass.id ? { ...c, ...formData } : c));
            } else {
                const docRef = await db.collection('classes').add({
                    ...formData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                setClasses([...classes, { id: docRef.id, ...formData }]);
            }
            
            setShowForm(false);
            setEditingClass(null);
            setFormData({ name: '', level: '', year: '' });
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) return;
        
        try {
            await firebase.firestore().collection('classes').doc(id).delete();
            setClasses(classes.filter(c => c.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const startEdit = (classe) => {
        setEditingClass(classe);
        setFormData({ name: classe.name, level: classe.level, year: classe.year });
        setShowForm(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>Gestion des Classes</h2>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingClass(null);
                        setFormData({ name: '', level: '', year: '' });
                    }}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    {showForm ? '✕ Annuler' : '+ Nouvelle classe'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Nom de la classe *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ex: 6ème A"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Niveau
                        </label>
                        <select
                            value={formData.level}
                            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        >
                            <option value="">Sélectionner...</option>
                            <option value="6ème">6ème</option>
                            <option value="5ème">5ème</option>
                            <option value="4ème">4ème</option>
                            <option value="3ème">3ème</option>
                            <option value="2nde">2nde</option>
                            <option value="1ère">1ère</option>
                            <option value="Terminale">Terminale</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Année scolaire
                        </label>
                        <input
                            type="text"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                            placeholder="Ex: 2024-2025"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#2c5f2d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {editingClass ? '💾 Mettre à jour' : '✓ Créer la classe'}
                    </button>
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {classes.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                        Aucune classe. Créez-en une pour commencer.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {classes.map(classe => {
                            const classStudents = students.filter(s => s.classId === classe.id);
                            
                            return (
                                <div key={classe.id} style={{
                                    padding: '20px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    backgroundColor: '#fff',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5f2d', marginBottom: '5px' }}>
                                            {classe.name}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#666' }}>
                                            {classe.level && `${classe.level} • `}
                                            {classe.year && classe.year}
                                            {classStudents.length > 0 && ` • ${classStudents.length} élève(s)`}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => startEdit(classe)}
                                            style={{
                                                padding: '8px 15px',
                                                backgroundColor: '#2196F3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            ✏️ Modifier
                                        </button>
                                        <button
                                            onClick={() => handleDelete(classe.id)}
                                            style={{
                                                padding: '8px 15px',
                                                backgroundColor: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            🗑️ Supprimer
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Gestion des élèves
function StudentsManager({ students, setStudents, classes }) {
    const [showForm, setShowForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', classId: '', number: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        
        try {
            if (editingStudent) {
                await db.collection('students').doc(editingStudent.id).update(formData);
                setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...formData } : s));
            } else {
                const docRef = await db.collection('students').add({
                    ...formData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                setStudents([...students, { id: docRef.id, ...formData }]);
            }
            
            setShowForm(false);
            setEditingStudent(null);
            setFormData({ firstName: '', lastName: '', classId: '', number: '' });
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet élève ?')) return;
        
        try {
            await firebase.firestore().collection('students').doc(id).delete();
            setStudents(students.filter(s => s.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const startEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            firstName: student.firstName,
            lastName: student.lastName,
            classId: student.classId,
            number: student.number || ''
        });
        setShowForm(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>Gestion des Élèves</h2>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingStudent(null);
                        setFormData({ firstName: '', lastName: '', classId: '', number: '' });
                    }}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    {showForm ? '✕ Annuler' : '+ Nouvel élève'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Prénom *
                            </label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Nom *
                            </label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Classe *
                        </label>
                        <select
                            value={formData.classId}
                            onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        >
                            <option value="">Sélectionner une classe...</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Numéro
                        </label>
                        <input
                            type="text"
                            value={formData.number}
                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                            placeholder="Ex: 15"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        style={{
                            marginTop: '15px',
                            padding: '10px 20px',
                            backgroundColor: '#2c5f2d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {editingStudent ? '💾 Mettre à jour' : '✓ Créer l\'élève'}
                    </button>
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {students.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                        Aucun élève. Ajoutez-en un pour commencer.
                    </p>
                ) : (
                    <div>
                        {classes.map(classe => {
                            const classStudents = students.filter(s => s.classId === classe.id);
                            if (classStudents.length === 0) return null;
                            
                            return (
                                <div key={classe.id} style={{ marginBottom: '30px' }}>
                                    <h3 style={{ color: '#2c5f2d', marginBottom: '15px' }}>
                                        {classe.name} ({classStudents.length} élève{classStudents.length > 1 ? 's' : ''})
                                    </h3>
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {classStudents.map(student => (
                                            <div key={student.id} style={{
                                                padding: '15px',
                                                border: '1px solid #ddd',
                                                borderRadius: '8px',
                                                backgroundColor: '#fff',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                                                        {student.number && `${student.number}. `}
                                                        {student.firstName} {student.lastName}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button
                                                        onClick={() => startEdit(student)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: '#2196F3',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '13px'
                                                        }}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(student.id)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: '#f44336',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '13px'
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Gestion des matières
function SubjectsManager({ subjects, setSubjects }) {
    const [showForm, setShowForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [formData, setFormData] = useState({ name: '', color: '#2c5f2d' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        
        try {
            if (editingSubject) {
                await db.collection('subjects').doc(editingSubject.id).update(formData);
                setSubjects(subjects.map(s => s.id === editingSubject.id ? { ...s, ...formData } : s));
            } else {
                const docRef = await db.collection('subjects').add({
                    ...formData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                setSubjects([...subjects, { id: docRef.id, ...formData }]);
            }
            
            setShowForm(false);
            setEditingSubject(null);
            setFormData({ name: '', color: '#2c5f2d' });
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette matière ?')) return;
        
        try {
            await firebase.firestore().collection('subjects').doc(id).delete();
            setSubjects(subjects.filter(s => s.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const startEdit = (subject) => {
        setEditingSubject(subject);
        setFormData({ name: subject.name, color: subject.color || '#2c5f2d' });
        setShowForm(true);
    };

    const predefinedColors = [
        '#2c5f2d', '#2196F3', '#FF9800', '#9C27B0', '#f44336', 
        '#4CAF50', '#00BCD4', '#FFC107', '#E91E63', '#607D8B'
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>Gestion des Matières</h2>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingSubject(null);
                        setFormData({ name: '', color: '#2c5f2d' });
                    }}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    {showForm ? '✕ Annuler' : '+ Nouvelle matière'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Nom de la matière *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ex: Mathématiques"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Couleur
                        </label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {predefinedColors.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color })}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        backgroundColor: color,
                                        border: formData.color === color ? '3px solid #333' : '1px solid #ddd',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#2c5f2d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {editingSubject ? '💾 Mettre à jour' : '✓ Créer la matière'}
                    </button>
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {subjects.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                        Aucune matière. Créez-en une pour commencer.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {subjects.map(subject => (
                            <div key={subject.id} style={{
                                padding: '20px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                backgroundColor: '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{
                                        width: '50px',
                                        height: '50px',
                                        backgroundColor: subject.color || '#2c5f2d',
                                        borderRadius: '8px'
                                    }} />
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                                        {subject.name}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => startEdit(subject)}
                                        style={{
                                            padding: '8px 15px',
                                            backgroundColor: '#2196F3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        ✏️ Modifier
                                    </button>
                                    <button
                                        onClick={() => handleDelete(subject.id)}
                                        style={{
                                            padding: '8px 15px',
                                            backgroundColor: '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        🗑️ Supprimer
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Gestion des devoirs
function AssignmentsManager({ assignments, setAssignments, classes, subjects }) {
    const [showForm, setShowForm] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        classId: '',
        subjectId: '',
        dueDate: '',
        type: 'homework'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        
        try {
            if (editingAssignment) {
                await db.collection('assignments').doc(editingAssignment.id).update(formData);
                setAssignments(assignments.map(a => a.id === editingAssignment.id ? { ...a, ...formData } : a));
            } else {
                const docRef = await db.collection('assignments').add({
                    ...formData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                setAssignments([...assignments, { id: docRef.id, ...formData }]);
            }
            
            setShowForm(false);
            setEditingAssignment(null);
            setFormData({ title: '', description: '', classId: '', subjectId: '', dueDate: '', type: 'homework' });
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce devoir ?')) return;
        
        try {
            await firebase.firestore().collection('assignments').doc(id).delete();
            setAssignments(assignments.filter(a => a.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const startEdit = (assignment) => {
        setEditingAssignment(assignment);
        setFormData({
            title: assignment.title,
            description: assignment.description || '',
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            dueDate: assignment.dueDate,
            type: assignment.type || 'homework'
        });
        setShowForm(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>Gestion des Devoirs</h2>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingAssignment(null);
                        setFormData({ title: '', description: '', classId: '', subjectId: '', dueDate: '', type: 'homework' });
                    }}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    {showForm ? '✕ Annuler' : '+ Nouveau devoir'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Titre *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            placeholder="Ex: Exercices page 45"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows="3"
                            placeholder="Description du devoir..."
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                fontFamily: 'Arial, sans-serif'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Classe *
                            </label>
                            <select
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">Sélectionner...</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Matière *
                            </label>
                            <select
                                value={formData.subjectId}
                                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">Sélectionner...</option>
                                {subjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Type
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="homework">Devoir</option>
                                <option value="test">Contrôle</option>
                                <option value="project">Projet</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Date limite *
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={{
                            marginTop: '15px',
                            padding: '10px 20px',
                            backgroundColor: '#2c5f2d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {editingAssignment ? '💾 Mettre à jour' : '✓ Créer le devoir'}
                    </button>
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {assignments.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                        Aucun devoir. Créez-en un pour commencer.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {assignments.map(assignment => {
                            const classe = classes.find(c => c.id === assignment.classId);
                            const subject = subjects.find(s => s.id === assignment.subjectId);
                            
                            return (
                                <div key={assignment.id} style={{
                                    padding: '20px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    backgroundColor: '#fff'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5f2d', marginBottom: '5px' }}>
                                                {assignment.title}
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#666' }}>
                                                {classe?.name} • {subject?.name} • 
                                                {assignment.type === 'homework' && ' Devoir'} 
                                                {assignment.type === 'test' && ' Contrôle'}
                                                {assignment.type === 'project' && ' Projet'}
                                                {assignment.dueDate && ` • Pour le ${new Date(assignment.dueDate).toLocaleDateString('fr-FR')}`}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => startEdit(assignment)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#2196F3',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(assignment.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    {assignment.description && (
                                        <div style={{ fontSize: '14px', color: '#555', marginTop: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                                            {assignment.description}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Gestion des séances
function SessionsManager({ sessions, setSessions, classes, subjects }) {
    const [showForm, setShowForm] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        classId: '',
        subjectId: '',
        date: '',
        duration: '1h'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        
        try {
            if (editingSession) {
                await db.collection('sessions').doc(editingSession.id).update(formData);
                setSessions(sessions.map(s => s.id === editingSession.id ? { ...s, ...formData } : s));
            } else {
                const docRef = await db.collection('sessions').add({
                    ...formData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                setSessions([...sessions, { id: docRef.id, ...formData }]);
            }
            
            setShowForm(false);
            setEditingSession(null);
            setFormData({ title: '', content: '', classId: '', subjectId: '', date: '', duration: '1h' });
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) return;
        
        try {
            await firebase.firestore().collection('sessions').doc(id).delete();
            setSessions(sessions.filter(s => s.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const startEdit = (session) => {
        setEditingSession(session);
        setFormData({
            title: session.title,
            content: session.content || '',
            classId: session.classId,
            subjectId: session.subjectId,
            date: session.date,
            duration: session.duration || '1h'
        });
        setShowForm(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>Gestion des Séances</h2>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingSession(null);
                        setFormData({ title: '', content: '', classId: '', subjectId: '', date: '', duration: '1h' });
                    }}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    {showForm ? '✕ Annuler' : '+ Nouvelle séance'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Titre *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            placeholder="Ex: Le passé composé"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Contenu du cours
                        </label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            rows="5"
                            placeholder="Contenu de la séance..."
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                fontFamily: 'Arial, sans-serif'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Classe *
                            </label>
                            <select
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">Sélectionner...</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Matière *
                            </label>
                            <select
                                value={formData.subjectId}
                                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">Sélectionner...</option>
                                {subjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Date *
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Durée
                            </label>
                            <input
                                type="text"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                placeholder="Ex: 1h30"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={{
                            marginTop: '15px',
                            padding: '10px 20px',
                            backgroundColor: '#2c5f2d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {editingSession ? '💾 Mettre à jour' : '✓ Créer la séance'}
                    </button>
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {sessions.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                        Aucune séance. Créez-en une pour commencer.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {sessions.map(session => {
                            const classe = classes.find(c => c.id === session.classId);
                            const subject = subjects.find(s => s.id === session.subjectId);
                            
                            return (
                                <div key={session.id} style={{
                                    padding: '20px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    backgroundColor: '#fff'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5f2d', marginBottom: '5px' }}>
                                                {session.title}
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#666' }}>
                                                {classe?.name} • {subject?.name} • 
                                                {session.date && ` ${new Date(session.date).toLocaleDateString('fr-FR')}`}
                                                {session.duration && ` • ${session.duration}`}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => startEdit(session)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#2196F3',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(session.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    {session.content && (
                                        <div style={{ fontSize: '14px', color: '#555', marginTop: '10px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                                            {session.content}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Rendu de l'application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminCahierTextes />);