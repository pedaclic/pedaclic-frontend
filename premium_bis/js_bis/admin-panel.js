const { useState, useEffect } = React;

// Composant principal du Panneau Admin
function AdminPanel() {
    const [currentView, setCurrentView] = useState('dashboard');
    const [levels, setLevels] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                
                try {
                    const userDoc = await firebase.firestore()
                        .collection('users')
                        .doc(currentUser.uid)
                        .get();
                    
                    if (userDoc.exists && userDoc.data().role === 'admin') {
                        setIsAdmin(true);
                        loadData();
                    } else {
                        alert('Accès refusé. Réservé aux administrateurs.');
                        window.location.href = '../premium.html';
                    }
                } catch (error) {
                    console.error('Erreur:', error);
                    window.location.href = '../premium.html';
                }
            } else {
                window.location.href = '../auth.html';
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loadData = async () => {
        try {
            const db = firebase.firestore();
            
            const levelsSnap = await db.collection('pedagogical_structure')
                .doc('levels')
                .collection('items')
                .orderBy('order')
                .get();
            setLevels(levelsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            const classesSnap = await db.collection('pedagogical_structure')
                .doc('classes')
                .collection('items')
                .orderBy('order')
                .get();
            setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            const subjectsSnap = await db.collection('pedagogical_structure')
                .doc('subjects')
                .collection('items')
                .get();
            setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Erreur chargement:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ fontSize: '20px', color: '#2c5f2d' }}>Chargement...</div>
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
            <header style={{
                backgroundColor: '#2c5f2d',
                color: 'white',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>⚙️ Panneau d'Administration</h1>
                    <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '14px' }}>
                        Configuration de la structure pédagogique PedaClic
                    </p>
                </div>
            </header>

            <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px' }}>
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
                        { id: 'dashboard', label: '📊 Vue d\'ensemble', icon: '📊' },
                        { id: 'levels', label: '🎓 Niveaux', icon: '🎓' },
                        { id: 'classes', label: '🏫 Classes', icon: '🏫' },
                        { id: 'subjects', label: '📚 Matières', icon: '📚' }
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

                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {currentView === 'dashboard' && <Dashboard levels={levels} classes={classes} subjects={subjects} />}
                    {currentView === 'levels' && <LevelsManager levels={levels} setLevels={setLevels} />}
                    {currentView === 'classes' && <ClassesManager classes={classes} setClasses={setClasses} levels={levels} />}
                    {currentView === 'subjects' && <SubjectsManager subjects={subjects} setSubjects={setSubjects} levels={levels} classes={classes} />}
                </div>
            </div>
        </div>
    );
}

// Dashboard
function Dashboard({ levels, classes, subjects }) {
    return (
        <div>
            <h2 style={{ marginTop: 0, color: '#2c5f2d' }}>Vue d'ensemble</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px' }}>
                <div style={{ backgroundColor: '#4CAF50', color: 'white', padding: '30px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{levels.length}</div>
                    <div style={{ fontSize: '16px', opacity: 0.9 }}>Niveaux configurés</div>
                </div>
                <div style={{ backgroundColor: '#2196F3', color: 'white', padding: '30px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{classes.length}</div>
                    <div style={{ fontSize: '16px', opacity: 0.9 }}>Classes disponibles</div>
                </div>
                <div style={{ backgroundColor: '#FF9800', color: 'white', padding: '30px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{subjects.length}</div>
                    <div style={{ fontSize: '16px', opacity: 0.9 }}>Matières actives</div>
                </div>
            </div>

            <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '2px solid #4CAF50' }}>
                <h3 style={{ margin: '0 0 10px', color: '#2c5f2d' }}>ℹ️ Guide rapide</h3>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                    <li>Commencez par créer les <strong>Niveaux</strong> (Primaire, Collège, Lycée)</li>
                    <li>Ensuite, ajoutez les <strong>Classes</strong> pour chaque niveau</li>
                    <li>Enfin, configurez les <strong>Matières</strong> disponibles par classe</li>
                    <li>Cette structure sera utilisée partout dans PedaClic</li>
                </ul>
            </div>
        </div>
    );
}

// Gestion des Niveaux
function LevelsManager({ levels, setLevels }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', order: 1, active: true });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('pedagogical_structure').doc('levels').collection('items');
        
        try {
            if (editing) {
                await ref.doc(editing.id).update(formData);
                setLevels(levels.map(l => l.id === editing.id ? { ...l, ...formData } : l));
            } else {
                const doc = await ref.add({ ...formData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                setLevels([...levels, { id: doc.id, ...formData }]);
            }
            resetForm();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer ce niveau ? Les classes associées seront orphelines.')) return;
        
        try {
            await firebase.firestore().collection('pedagogical_structure').doc('levels').collection('items').doc(id).delete();
            setLevels(levels.filter(l => l.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const startEdit = (level) => {
        setEditing(level);
        setFormData({ name: level.name, order: level.order, active: level.active });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setFormData({ name: '', order: 1, active: true });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>🎓 Gestion des Niveaux</h2>
                <button onClick={() => setShowForm(!showForm)} style={{
                    padding: '10px 20px',
                    backgroundColor: '#2c5f2d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    {showForm ? '✕ Annuler' : '+ Nouveau niveau'}
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
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom du niveau *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ex: Collège"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ordre d'affichage</label>
                        <input
                            type="number"
                            value={formData.order}
                            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                            min="1"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.active}
                                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>Niveau actif</span>
                        </label>
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
                {levels.sort((a, b) => a.order - b.order).map(level => (
                    <div key={level.id} style={{
                        padding: '20px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: level.active ? 'white' : '#f5f5f5'
                    }}>
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5f2d' }}>
                                {level.name} {!level.active && '(Inactif)'}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666' }}>Ordre: {level.order}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => startEdit(level)} style={{
                                padding: '8px 15px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}>
                                ✏️ Modifier
                            </button>
                            <button onClick={() => handleDelete(level.id)} style={{
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
                ))}
            </div>

            {levels.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    Aucun niveau configuré. Créez-en un pour commencer.
                </div>
            )}
        </div>
    );
}

// Gestion des Classes
function ClassesManager({ classes, setClasses, levels }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', levelId: '', order: 1, active: true });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('pedagogical_structure').doc('classes').collection('items');
        
        try {
            if (editing) {
                await ref.doc(editing.id).update(formData);
                setClasses(classes.map(c => c.id === editing.id ? { ...c, ...formData } : c));
            } else {
                const doc = await ref.add({ ...formData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                setClasses([...classes, { id: doc.id, ...formData }]);
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
            await firebase.firestore().collection('pedagogical_structure').doc('classes').collection('items').doc(id).delete();
            setClasses(classes.filter(c => c.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const startEdit = (classe) => {
        setEditing(classe);
        setFormData({ name: classe.name, levelId: classe.levelId, order: classe.order, active: classe.active });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setFormData({ name: '', levelId: '', order: 1, active: true });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>🏫 Gestion des Classes</h2>
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
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom de la classe *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ex: 6ème"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Niveau *</label>
                        <select
                            value={formData.levelId}
                            onChange={(e) => setFormData({ ...formData, levelId: e.target.value })}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="">Sélectionner un niveau...</option>
                            {levels.filter(l => l.active).map(level => (
                                <option key={level.id} value={level.id}>{level.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ordre d'affichage</label>
                        <input
                            type="number"
                            value={formData.order}
                            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                            min="1"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.active}
                                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>Classe active</span>
                        </label>
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

            {levels.map(level => {
                const levelClasses = classes.filter(c => c.levelId === level.id).sort((a, b) => a.order - b.order);
                if (levelClasses.length === 0) return null;

                return (
                    <div key={level.id} style={{ marginBottom: '30px' }}>
                        <h3 style={{ color: '#2c5f2d', marginBottom: '15px' }}>
                            {level.name} ({levelClasses.length})
                        </h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {levelClasses.map(classe => (
                                <div key={classe.id} style={{
                                    padding: '15px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: classe.active ? 'white' : '#f5f5f5'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#333' }}>
                                            {classe.name} {!classe.active && '(Inactive)'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>Ordre: {classe.order}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => startEdit(classe)} style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#2196F3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '13px'
                                        }}>
                                            ✏️
                                        </button>
                                        <button onClick={() => handleDelete(classe.id)} style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '13px'
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

            {classes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    Aucune classe configurée. Créez-en une pour commencer.
                </div>
            )}
        </div>
    );
}

// Gestion des Matières
function SubjectsManager({ subjects, setSubjects, levels, classes }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', levelId: '', classIds: [], color: '#2c5f2d', active: true });

    const colors = ['#2c5f2d', '#2196F3', '#FF9800', '#9C27B0', '#f44336', '#4CAF50', '#00BCD4', '#FFC107'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = firebase.firestore();
        const ref = db.collection('pedagogical_structure').doc('subjects').collection('items');
        
        try {
            if (editing) {
                await ref.doc(editing.id).update(formData);
                setSubjects(subjects.map(s => s.id === editing.id ? { ...s, ...formData } : s));
            } else {
                const doc = await ref.add({ ...formData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                setSubjects([...subjects, { id: doc.id, ...formData }]);
            }
            resetForm();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer cette matière ?')) return;
        
        try {
            await firebase.firestore().collection('pedagogical_structure').doc('subjects').collection('items').doc(id).delete();
            setSubjects(subjects.filter(s => s.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const startEdit = (subject) => {
        setEditing(subject);
        setFormData({ 
            name: subject.name, 
            levelId: subject.levelId, 
            classIds: subject.classIds || [], 
            color: subject.color,
            active: subject.active 
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setFormData({ name: '', levelId: '', classIds: [], color: '#2c5f2d', active: true });
    };

    const levelClasses = formData.levelId ? classes.filter(c => c.levelId === formData.levelId && c.active) : [];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c5f2d' }}>📚 Gestion des Matières</h2>
                <button onClick={() => setShowForm(!showForm)} style={{
                    padding: '10px 20px',
                    backgroundColor: '#2c5f2d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    {showForm ? '✕ Annuler' : '+ Nouvelle matière'}
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
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom de la matière *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ex: Français"
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Niveau *</label>
                        <select
                            value={formData.levelId}
                            onChange={(e) => setFormData({ ...formData, levelId: e.target.value, classIds: [] })}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="">Sélectionner un niveau...</option>
                            {levels.filter(l => l.active).map(level => (
                                <option key={level.id} value={level.id}>{level.name}</option>
                            ))}
                        </select>
                    </div>

                    {formData.levelId && levelClasses.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                Classes concernées (optionnel - cochez pour restreindre)
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                                {levelClasses.map(classe => (
                                    <label key={classe.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        padding: '8px',
                                        backgroundColor: 'white',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        border: '1px solid #ddd'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.classIds.includes(classe.id)}
                                            onChange={(e) => {
                                                const newIds = e.target.checked
                                                    ? [...formData.classIds, classe.id]
                                                    : formData.classIds.filter(id => id !== classe.id);
                                                setFormData({ ...formData, classIds: newIds });
                                            }}
                                            style={{ marginRight: '8px' }}
                                        />
                                        {classe.name}
                                    </label>
                                ))}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                {formData.classIds.length === 0 ? 'Toutes les classes' : `${formData.classIds.length} classe(s) sélectionnée(s)`}
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Couleur</label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {colors.map(color => (
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

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.active}
                                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>Matière active</span>
                        </label>
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

            {levels.map(level => {
                const levelSubjects = subjects.filter(s => s.levelId === level.id);
                if (levelSubjects.length === 0) return null;

                return (
                    <div key={level.id} style={{ marginBottom: '30px' }}>
                        <h3 style={{ color: '#2c5f2d', marginBottom: '15px' }}>
                            {level.name} ({levelSubjects.length})
                        </h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {levelSubjects.map(subject => {
                                const subjectClasses = subject.classIds?.length > 0
                                    ? classes.filter(c => subject.classIds.includes(c.id)).map(c => c.name).join(', ')
                                    : 'Toutes les classes';
                                
                                return (
                                    <div key={subject.id} style={{
                                        padding: '15px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        backgroundColor: subject.active ? 'white' : '#f5f5f5'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                backgroundColor: subject.color,
                                                borderRadius: '6px'
                                            }} />
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#333' }}>
                                                    {subject.name} {!subject.active && '(Inactive)'}
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#666' }}>{subjectClasses}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => startEdit(subject)} style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#2196F3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}>
                                                ✏️
                                            </button>
                                            <button onClick={() => handleDelete(subject.id)} style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {subjects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    Aucune matière configurée. Créez-en une pour commencer.
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminPanel />);