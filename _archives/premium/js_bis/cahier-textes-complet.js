const { useState, useEffect } = React;

function CahierTextes() {
    const [currentView, setCurrentView] = useState('dashboard');
    const [user, setUser] = useState(null);
    const [myClasses, setMyClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState([]);
    const [textEntries, setTextEntries] = useState([]);
    const [pedagogicalStructure, setPedagogicalStructure] = useState({ levels: [], classes: [], subjects: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await loadPedagogicalStructure();
                await loadTeacherData(currentUser.uid);
            } else {
                window.location.href = '../auth.html';
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loadPedagogicalStructure = async () => {
        const db = firebase.firestore();
        
        try {
            const levelsSnap = await db.collection('pedagogical_structure').doc('levels').collection('items').get();
            const classesSnap = await db.collection('pedagogical_structure').doc('classes').collection('items').get();
            const subjectsSnap = await db.collection('pedagogical_structure').doc('subjects').collection('items').get();

            setPedagogicalStructure({
                levels: levelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                subjects: subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch (error) {
            console.error('Erreur chargement structure:', error);
        }
    };

    const loadTeacherData = async (userId) => {
        const db = firebase.firestore();
        const teacherRef = db.collection('teacher_data').doc(userId);

        try {
            const classesSnap = await teacherRef.collection('my_classes').get();
            setMyClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            const studentsSnap = await teacherRef.collection('students').get();
            setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            const gradesSnap = await teacherRef.collection('grades').get();
            setGrades(gradesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            const entriesSnap = await teacherRef.collection('text_entries').get();
            setTextEntries(entriesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error('Erreur chargement données enseignant:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ fontSize: '20px', color: '#2c5f2d' }}>Chargement...</div>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
            <header style={{
                backgroundColor: '#2c5f2d',
                color: 'white',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>📓 Mon Cahier de Textes</h1>
                    <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '14px' }}>
                        Gestion complète de vos classes, élèves, notes et devoirs
                    </p>
                </div>
            </header>

            <div style={{ maxWidth: '1400px', margin: '20px auto', padding: '0 20px' }}>
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
                        { id: 'classes', label: '🏫 Mes Classes' },
                        { id: 'students', label: '👨‍🎓 Élèves' },
                        { id: 'grades', label: '📝 Notes' },
                        { id: 'entries', label: '📅 Cahier de textes' },
                        { id: 'stats', label: '📈 Statistiques' }
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
                                fontWeight: currentView === item.id ? 'bold' : 'normal'
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {currentView === 'dashboard' && (
                        <Dashboard 
                            myClasses={myClasses}
                            students={students}
                            grades={grades}
                            textEntries={textEntries}
                        />
                    )}
                    {currentView === 'classes' && (
                        <ClassesManager 
                            myClasses={myClasses}
                            setMyClasses={setMyClasses}
                            pedagogicalStructure={pedagogicalStructure}
                            userId={user.uid}
                        />
                    )}
                    {currentView === 'students' && (
                        <StudentsManager 
                            students={students}
                            setStudents={setStudents}
                            myClasses={myClasses}
                            userId={user.uid}
                        />
                    )}
                    {currentView === 'grades' && (
                        <GradesManager 
                            grades={grades}
                            setGrades={setGrades}
                            students={students}
                            myClasses={myClasses}
                            pedagogicalStructure={pedagogicalStructure}
                            userId={user.uid}
                        />
                    )}
                    {currentView === 'entries' && (
                        <TextEntriesManager 
                            textEntries={textEntries}
                            setTextEntries={setTextEntries}
                            myClasses={myClasses}
                            pedagogicalStructure={pedagogicalStructure}
                            userId={user.uid}
                        />
                    )}
                    {currentView === 'stats' && (
                        <Statistics 
                            myClasses={myClasses}
                            students={students}
                            grades={grades}
                            pedagogicalStructure={pedagogicalStructure}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Dashboard
function Dashboard({ myClasses, students, grades, textEntries }) {
    const recentEntries = textEntries.slice(-5).reverse();

    return (
        <div>
            <h2 style={{ marginTop: 0, color: '#2c5f2d' }}>Tableau de bord</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px' }}>
                <div style={{ backgroundColor: '#4CAF50', color: 'white', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '42px', fontWeight: 'bold' }}>{myClasses.length}</div>
                    <div>Classe{myClasses.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ backgroundColor: '#2196F3', color: 'white', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '42px', fontWeight: 'bold' }}>{students.length}</div>
                    <div>Élève{students.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ backgroundColor: '#FF9800', color: 'white', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '42px', fontWeight: 'bold' }}>{grades.length}</div>
                    <div>Note{grades.length > 1 ? 's' : ''}</div>
                </div>
                <div style={{ backgroundColor: '#9C27B0', color: 'white', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '42px', fontWeight: 'bold' }}>{textEntries.length}</div>
                    <div>Entrée{textEntries.length > 1 ? 's' : ''}</div>
                </div>
            </div>

            {recentEntries.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <h3 style={{ color: '#2c5f2d' }}>Dernières entrées du cahier de textes</h3>
                    <div style={{ marginTop: '15px' }}>
                        {recentEntries.map(entry => (
                            <div key={entry.id} style={{
                                padding: '15px',
                                marginBottom: '10px',
                                backgroundColor: '#f9f9f9',
                                borderRadius: '6px',
                                borderLeft: '4px solid #2c5f2d'
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{entry.title}</div>
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                    {entry.date && new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.type === 'homework' ? 'Devoir' : 'Séance'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Gestion des Classes
function ClassesManager({ myClasses, setMyClasses, pedagogicalStructure, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', levelId: '', classId: '', year: '2024-2025' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('teacher_data').doc(userId).collection('my_classes');

        try {
            if (editing) {
                await ref.doc(editing.id).update(formData);
                setMyClasses(myClasses.map(c => c.id === editing.id ? { ...c, ...formData } : c));
            } else {
                const doc = await ref.add({ ...formData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                setMyClasses([...myClasses, { id: doc.id, ...formData }]);
            }
            resetForm();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer cette classe ?')) return;
        
        try {
            await firebase.firestore().collection('teacher_data').doc(userId).collection('my_classes').doc(id).delete();
            setMyClasses(myClasses.filter(c => c.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const startEdit = (classe) => {
        setEditing(classe);
        setFormData({ name: classe.name, levelId: classe.levelId, classId: classe.classId, year: classe.year });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setFormData({ name: '', levelId: '', classId: '', year: '2024-2025' });
    };

    const levelClasses = formData.levelId 
        ? pedagogicalStructure.classes.filter(c => c.levelId === formData.levelId && c.active)
        : [];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>🏫 Mes Classes</h2>
                <button onClick={() => setShowForm(!showForm)} style={{
                    padding: '10px 20px',
                    backgroundColor: '#2c5f2d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    {showForm ? '✕ Annuler' : '+ Nouvelle classe'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom personnalisé *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ex: 6ème A - Salle 12"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Niveau *</label>
                        <select
                            value={formData.levelId}
                            onChange={(e) => setFormData({ ...formData, levelId: e.target.value, classId: '' })}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="">Sélectionner...</option>
                            {pedagogicalStructure.levels.filter(l => l.active).map(level => (
                                <option key={level.id} value={level.id}>{level.name}</option>
                            ))}
                        </select>
                    </div>

                    {levelClasses.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Classe *</label>
                            <select
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                                <option value="">Sélectionner...</option>
                                {levelClasses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Année scolaire</label>
                        <input
                            type="text"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                            placeholder="2024-2025"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <button type="submit" style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}>
                        {editing ? '💾 Mettre à jour' : '✓ Créer'}
                    </button>
                </form>
            )}

            <div style={{ display: 'grid', gap: '15px' }}>
                {myClasses.map(classe => {
                    const level = pedagogicalStructure.levels.find(l => l.id === classe.levelId);
                    const classeDef = pedagogicalStructure.classes.find(c => c.id === classe.classId);
                    
                    return (
                        <div key={classe.id} style={{
                            padding: '20px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5f2d' }}>
                                    {classe.name}
                                </div>
                                <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                                    {level?.name} • {classeDef?.name} • {classe.year}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => startEdit(classe)} style={{
                                    padding: '8px 15px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}>
                                    ✏️ Modifier
                                </button>
                                <button onClick={() => handleDelete(classe.id)} style={{
                                    padding: '8px 15px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}>
                                    🗑️ Supprimer
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {myClasses.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    Aucune classe. Créez-en une pour commencer.
                </div>
            )}
        </div>
    );
}

// Gestion des Élèves
function StudentsManager({ students, setStudents, myClasses, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', classId: '', number: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('teacher_data').doc(userId).collection('students');

        try {
            if (editing) {
                await ref.doc(editing.id).update(formData);
                setStudents(students.map(s => s.id === editing.id ? { ...s, ...formData } : s));
            } else {
                const doc = await ref.add({ ...formData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                setStudents([...students, { id: doc.id, ...formData }]);
            }
            resetForm();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer cet élève ? Les notes associées seront conservées.')) return;
        
        try {
            await firebase.firestore().collection('teacher_data').doc(userId).collection('students').doc(id).delete();
            setStudents(students.filter(s => s.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const startEdit = (student) => {
        setEditing(student);
        setFormData({ firstName: student.firstName, lastName: student.lastName, classId: student.classId, number: student.number || '' });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setFormData({ firstName: '', lastName: '', classId: '', number: '' });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>👨‍🎓 Gestion des Élèves</h2>
                <button onClick={() => setShowForm(!showForm)} style={{
                    padding: '10px 20px',
                    backgroundColor: '#2c5f2d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    {showForm ? '✕ Annuler' : '+ Nouvel élève'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Prénom *</label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom *</label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Classe *</label>
                        <select
                            value={formData.classId}
                            onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="">Sélectionner...</option>
                            {myClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Numéro</label>
                        <input
                            type="text"
                            value={formData.number}
                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                            placeholder="Ex: 15"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <button type="submit" style={{
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}>
                        {editing ? '💾 Mettre à jour' : '✓ Créer'}
                    </button>
                </form>
            )}

            {myClasses.map(classe => {
                const classStudents = students.filter(s => s.classId === classe.id);
                if (classStudents.length === 0) return null;

                return (
                    <div key={classe.id} style={{ marginBottom: '30px' }}>
                        <h3 style={{ color: '#2c5f2d', marginBottom: '15px' }}>
                            {classe.name} ({classStudents.length} élève{classStudents.length > 1 ? 's' : ''})
                        </h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {classStudents.sort((a, b) => (a.number || 999) - (b.number || 999)).map(student => (
                                <div key={student.id} style={{
                                    padding: '15px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {student.number && `${student.number}. `}
                                        {student.firstName} {student.lastName}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => startEdit(student)} style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#2196F3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}>
                                            ✏️
                                        </button>
                                        <button onClick={() => handleDelete(student.id)} style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}>
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {students.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    Aucun élève. Ajoutez-en un pour commencer.
                </div>
            )}
        </div>
    );
}

// Gestion des Notes
function GradesManager({ grades, setGrades, students, myClasses, pedagogicalStructure, userId }) {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ studentId: '', subjectId: '', grade: '', coefficient: 1, comment: '', date: '' });

    const classSubjects = selectedClass 
        ? pedagogicalStructure.subjects.filter(s => {
            const classe = myClasses.find(c => c.id === selectedClass);
            return classe && s.levelId === classe.levelId && s.active &&
                (!s.classIds?.length || s.classIds.includes(classe.classId));
        })
        : [];

    const classStudents = selectedClass ? students.filter(s => s.classId === selectedClass) : [];

    const filteredGrades = grades.filter(g => 
        (!selectedClass || students.find(s => s.id === g.studentId)?.classId === selectedClass) &&
        (!selectedSubject || g.subjectId === selectedSubject)
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('teacher_data').doc(userId).collection('grades');

        try {
            const gradeData = {
                ...formData,
                grade: parseFloat(formData.grade),
                coefficient: parseFloat(formData.coefficient),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const doc = await ref.add(gradeData);
            setGrades([...grades, { id: doc.id, ...gradeData }]);
            resetForm();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer cette note ?')) return;
        
        try {
            await firebase.firestore().collection('teacher_data').doc(userId).collection('grades').doc(id).delete();
            setGrades(grades.filter(g => g.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setFormData({ studentId: '', subjectId: '', grade: '', coefficient: 1, comment: '', date: '' });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>📝 Gestion des Notes</h2>
                <button onClick={() => setShowForm(!showForm)} style={{
                    padding: '10px 20px',
                    backgroundColor: '#2c5f2d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    {showForm ? '✕ Annuler' : '+ Nouvelle note'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filtrer par classe</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }}
                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                        <option value="">Toutes les classes</option>
                        {myClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filtrer par matière</label>
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        disabled={!selectedClass}
                    >
                        <option value="">Toutes les matières</option>
                        {classSubjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Classe *</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => { setSelectedClass(e.target.value); setFormData({ ...formData, studentId: '', subjectId: '' }); }}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="">Sélectionner...</option>
                            {myClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedClass && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Élève *</label>
                                    <select
                                        value={formData.studentId}
                                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    >
                                        <option value="">Sélectionner...</option>
                                        {classStudents.map(s => (
                                            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Matière *</label>
                                    <select
                                        value={formData.subjectId}
                                        onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    >
                                        <option value="">Sélectionner...</option>
                                        {classSubjects.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Note /20 *</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        max="20"
                                        value={formData.grade}
                                        onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Coefficient</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0.5"
                                        value={formData.coefficient}
                                        onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Commentaire</label>
                                <textarea
                                    value={formData.comment}
                                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                    rows="2"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'Arial' }}
                                />
                            </div>

                            <button type="submit" style={{
                                padding: '10px 20px',
                                backgroundColor: '#2c5f2d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}>
                                ✓ Enregistrer la note
                            </button>
                        </>
                    )}
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {filteredGrades.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        Aucune note. Ajoutez-en une pour commencer.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {filteredGrades.map(grade => {
                            const student = students.find(s => s.id === grade.studentId);
                            const subject = pedagogicalStructure.subjects.find(s => s.id === grade.subjectId);
                            
                            return (
                                <div key={grade.id} style={{
                                    padding: '15px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {student?.firstName} {student?.lastName} • {subject?.name}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#666', marginTop: '3px' }}>
                                            Note: {grade.grade}/20 • Coef: {grade.coefficient}
                                            {grade.date && ` • ${new Date(grade.date).toLocaleDateString('fr-FR')}`}
                                        </div>
                                        {grade.comment && (
                                            <div style={{ fontSize: '13px', color: '#555', marginTop: '5px', fontStyle: 'italic' }}>
                                                {grade.comment}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => handleDelete(grade.id)} style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#f44336',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}>
                                        🗑️
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Gestion du Cahier de Textes
function TextEntriesManager({ textEntries, setTextEntries, myClasses, pedagogicalStructure, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', content: '', classId: '', subjectId: '', type: 'homework', date: '', dueDate: '' });

    const classSubjects = formData.classId 
        ? pedagogicalStructure.subjects.filter(s => {
            const classe = myClasses.find(c => c.id === formData.classId);
            return classe && s.levelId === classe.levelId && s.active &&
                (!s.classIds?.length || s.classIds.includes(classe.classId));
        })
        : [];

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('teacher_data').doc(userId).collection('text_entries');

        try {
            const doc = await ref.add({ ...formData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            setTextEntries([...textEntries, { id: doc.id, ...formData }]);
            resetForm();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer cette entrée ?')) return;
        
        try {
            await firebase.firestore().collection('teacher_data').doc(userId).collection('text_entries').doc(id).delete();
            setTextEntries(textEntries.filter(e => e.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setFormData({ title: '', content: '', classId: '', subjectId: '', type: 'homework', date: '', dueDate: '' });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>📅 Cahier de Textes</h2>
                <button onClick={() => setShowForm(!showForm)} style={{
                    padding: '10px 20px',
                    backgroundColor: '#2c5f2d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    {showForm ? '✕ Annuler' : '+ Nouvelle entrée'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} style={{
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '2px solid #2c5f2d'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Type *</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="homework">Devoir à faire</option>
                            <option value="lesson">Séance de cours</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Titre *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            placeholder="Ex: Exercices page 45"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contenu</label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            rows="4"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'Arial' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Classe *</label>
                            <select
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value, subjectId: '' })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                                <option value="">Sélectionner...</option>
                                {myClasses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Matière</label>
                            <select
                                value={formData.subjectId}
                                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                disabled={!formData.classId}
                            >
                                <option value="">Aucune</option>
                                {classSubjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date *</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                        </div>
                        {formData.type === 'homework' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>À rendre le</label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </div>
                        )}
                    </div>

                    <button type="submit" style={{
                        marginTop: '15px',
                        padding: '10px 20px',
                        backgroundColor: '#2c5f2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}>
                        ✓ Enregistrer
                    </button>
                </form>
            )}

            <div style={{ marginTop: '30px' }}>
                {textEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        Aucune entrée. Créez-en une pour commencer.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {textEntries.sort((a, b) => new Date(b.date) - new Date(a.date)).map(entry => {
                            const classe = myClasses.find(c => c.id === entry.classId);
                            const subject = entry.subjectId ? pedagogicalStructure.subjects.find(s => s.id === entry.subjectId) : null;
                            
                            return (
                                <div key={entry.id} style={{
                                    padding: '20px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    borderLeft: `4px solid ${entry.type === 'homework' ? '#FF9800' : '#2196F3'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5f2d' }}>
                                                {entry.title}
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                                                {classe?.name} {subject && `• ${subject.name}`} • 
                                                {entry.type === 'homework' ? ' Devoir' : ' Séance'} • 
                                                {entry.date && new Date(entry.date).toLocaleDateString('fr-FR')}
                                                {entry.dueDate && ` → À rendre le ${new Date(entry.dueDate).toLocaleDateString('fr-FR')}`}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete(entry.id)} style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}>
                                            🗑️
                                        </button>
                                    </div>
                                    {entry.content && (
                                        <div style={{
                                            padding: '15px',
                                            backgroundColor: '#f9f9f9',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            color: '#555',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {entry.content}
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

// Statistiques
function Statistics({ myClasses, students, grades, pedagogicalStructure }) {
    const [selectedClass, setSelectedClass] = useState('');

    const calculateAverage = (studentId, subjectId = null) => {
        const studentGrades = grades.filter(g => 
            g.studentId === studentId && 
            (!subjectId || g.subjectId === subjectId)
        );
        
        if (studentGrades.length === 0) return null;
        
        const sum = studentGrades.reduce((acc, g) => acc + (g.grade * g.coefficient), 0);
        const totalCoef = studentGrades.reduce((acc, g) => acc + g.coefficient, 0);
        
        return (sum / totalCoef).toFixed(2);
    };

    const classStudents = selectedClass ? students.filter(s => s.classId === selectedClass) : [];
    const classe = myClasses.find(c => c.id === selectedClass);
    const classSubjects = classe 
        ? pedagogicalStructure.subjects.filter(s => 
            s.levelId === classe.levelId && s.active &&
            (!s.classIds?.length || s.classIds.includes(classe.classId))
        )
        : [];

    return (
        <div>
            <h2 style={{ marginTop: 0, color: '#2c5f2d' }}>📈 Statistiques</h2>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Classe</label>
                <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                    <option value="">Sélectionner une classe...</option>
                    {myClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {selectedClass && classStudents.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#2c5f2d', color: 'white' }}>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Élève</th>
                                {classSubjects.map(subject => (
                                    <th key={subject.id} style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                                        {subject.name}
                                    </th>
                                ))}
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>
                                    Moyenne Générale
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {classStudents.sort((a, b) => (a.number || 999) - (b.number || 999)).map(student => {
                                const generalAvg = calculateAverage(student.id);
                                
                                return (
                                    <tr key={student.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>
                                            {student.firstName} {student.lastName}
                                        </td>
                                        {classSubjects.map(subject => {
                                            const avg = calculateAverage(student.id, subject.id);
                                            return (
                                                <td key={subject.id} style={{ 
                                                    padding: '12px', 
                                                    textAlign: 'center',
                                                    color: avg ? (avg >= 10 ? '#4CAF50' : '#f44336') : '#999'
                                                }}>
                                                    {avg || '-'}
                                                </td>
                                            );
                                        })}
                                        <td style={{ 
                                            padding: '12px', 
                                            textAlign: 'center', 
                                            fontWeight: 'bold',
                                            backgroundColor: '#f9f9f9',
                                            color: generalAvg ? (generalAvg >= 10 ? '#4CAF50' : '#f44336') : '#999'
                                        }}>
                                            {generalAvg || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!selectedClass && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    Sélectionnez une classe pour voir les statistiques
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<CahierTextes />);