const { useState, useEffect } = React;

function GenerateurContenus() {
    const [user, setUser] = useState(null);
    const [pedagogicalStructure, setPedagogicalStructure] = useState({ levels: [], classes: [], subjects: [] });
    const [selectedLevel, setSelectedLevel] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [contentType, setContentType] = useState('course');
    const [topic, setTopic] = useState('');
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    const [generatedContent, setGeneratedContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedContents, setSavedContents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await loadPedagogicalStructure();
                await loadSavedContents(currentUser.uid);
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
            const levelsSnap = await db.collection('pedagogical_structure').doc('levels').collection('items')
                .where('active', '==', true)
                .orderBy('order')
                .get();
            const classesSnap = await db.collection('pedagogical_structure').doc('classes').collection('items')
                .where('active', '==', true)
                .orderBy('order')
                .get();
            const subjectsSnap = await db.collection('pedagogical_structure').doc('subjects').collection('items')
                .where('active', '==', true)
                .get();

            setPedagogicalStructure({
                levels: levelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                subjects: subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch (error) {
            console.error('Erreur chargement structure:', error);
        }
    };

    const loadSavedContents = async (userId) => {
        try {
            const snapshot = await firebase.firestore()
                .collection('generated_contents')
                .doc(userId)
                .collection('contents')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            
            setSavedContents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error('Erreur chargement contenus:', error);
        }
    };

    const availableClasses = selectedLevel 
        ? pedagogicalStructure.classes.filter(c => c.levelId === selectedLevel)
        : [];

    const availableSubjects = selectedLevel && selectedClass
        ? pedagogicalStructure.subjects.filter(s => 
            s.levelId === selectedLevel && 
            (!s.classIds || s.classIds.length === 0 || s.classIds.includes(selectedClass))
        )
        : [];

    const generateContent = async () => {
        if (!selectedLevel || !selectedClass || !selectedSubject || !topic) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }

        setIsGenerating(true);
        setGeneratedContent('');

        try {
            const level = pedagogicalStructure.levels.find(l => l.id === selectedLevel);
            const classe = pedagogicalStructure.classes.find(c => c.id === selectedClass);
            const subject = pedagogicalStructure.subjects.find(s => s.id === selectedSubject);

            const contentTypeLabels = {
                course: 'un cours complet',
                exercises: 'des exercices avec corrigés',
                evaluation: 'une évaluation avec barème',
                lesson_plan: 'une fiche de préparation de séance',
                worksheet: 'une fiche d\'activités',
                summary: 'une fiche de révision'
            };

            const prompt = `Tu es un enseignant expert. Génère ${contentTypeLabels[contentType]} pour :
- Niveau: ${level.name}
- Classe: ${classe.name}
- Matière: ${subject.name}
- Sujet: ${topic}

${additionalInstructions ? `Instructions supplémentaires: ${additionalInstructions}` : ''}

Le contenu doit être adapté au niveau scolaire sénégalais et respecter les programmes en vigueur.
Fournis un contenu structuré, clair et directement utilisable en classe.`;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 4000,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la génération');
            }

            const data = await response.json();
            const content = data.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');

            setGeneratedContent(content);

        } catch (error) {
            console.error('Erreur génération:', error);
            alert('Erreur lors de la génération du contenu. Veuillez réessayer.');
        } finally {
            setIsGenerating(false);
        }
    };

    const saveContent = async () => {
        if (!generatedContent) return;

        try {
            const level = pedagogicalStructure.levels.find(l => l.id === selectedLevel);
            const classe = pedagogicalStructure.classes.find(c => c.id === selectedClass);
            const subject = pedagogicalStructure.subjects.find(s => s.id === selectedSubject);

            const contentData = {
                levelId: selectedLevel,
                levelName: level.name,
                classId: selectedClass,
                className: classe.name,
                subjectId: selectedSubject,
                subjectName: subject.name,
                contentType,
                topic,
                content: generatedContent,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const doc = await firebase.firestore()
                .collection('generated_contents')
                .doc(user.uid)
                .collection('contents')
                .add(contentData);

            setSavedContents([{ id: doc.id, ...contentData }, ...savedContents]);
            alert('Contenu sauvegardé avec succès !');
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        }
    };

    const exportToPDF = () => {
        if (!generatedContent) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const level = pedagogicalStructure.levels.find(l => l.id === selectedLevel);
        const classe = pedagogicalStructure.classes.find(c => c.id === selectedClass);
        const subject = pedagogicalStructure.subjects.find(s => s.id === selectedSubject);

        doc.setFontSize(16);
        doc.text(topic, 20, 20);
        
        doc.setFontSize(10);
        doc.text(`${level.name} - ${classe.name} - ${subject.name}`, 20, 30);
        
        doc.setFontSize(12);
        const lines = doc.splitTextToSize(generatedContent, 170);
        doc.text(lines, 20, 40);

        doc.save(`${topic.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedContent);
        alert('Contenu copié dans le presse-papier !');
    };

    const deleteContent = async (id) => {
        if (!confirm('Supprimer ce contenu ?')) return;

        try {
            await firebase.firestore()
                .collection('generated_contents')
                .doc(user.uid)
                .collection('contents')
                .doc(id)
                .delete();
            
            setSavedContents(savedContents.filter(c => c.id !== id));
        } catch (error) {
            console.error('Erreur suppression:', error);
        }
    };

    const loadSavedContent = (content) => {
        setSelectedLevel(content.levelId);
        setSelectedClass(content.classId);
        setSelectedSubject(content.subjectId);
        setContentType(content.contentType);
        setTopic(content.topic);
        setGeneratedContent(content.content);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    <h1 style={{ margin: 0, fontSize: '24px' }}>🤖 Générateur de Contenus IA</h1>
                    <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '14px' }}>
                        Créez des contenus pédagogiques personnalisés avec l'intelligence artificielle
                    </p>
                </div>
            </header>

            <div style={{ maxWidth: '1400px', margin: '20px auto', padding: '0 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    {/* Panneau de génération */}
                    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ marginTop: 0, color: '#2c5f2d' }}>Nouveau contenu</h2>

                        {/* Sélection en cascade */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                1️⃣ Niveau *
                            </label>
                            <select
                                value={selectedLevel}
                                onChange={(e) => {
                                    setSelectedLevel(e.target.value);
                                    setSelectedClass('');
                                    setSelectedSubject('');
                                }}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                                <option value="">Sélectionner un niveau...</option>
                                {pedagogicalStructure.levels.map(level => (
                                    <option key={level.id} value={level.id}>{level.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedLevel && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    2️⃣ Classe *
                                </label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => {
                                        setSelectedClass(e.target.value);
                                        setSelectedSubject('');
                                    }}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                >
                                    <option value="">Sélectionner une classe...</option>
                                    {availableClasses.map(classe => (
                                        <option key={classe.id} value={classe.id}>{classe.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedClass && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    3️⃣ Matière *
                                </label>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                >
                                    <option value="">Sélectionner une matière...</option>
                                    {availableSubjects.map(subject => (
                                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedSubject && (
                            <>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                        4️⃣ Type de contenu *
                                    </label>
                                    <select
                                        value={contentType}
                                        onChange={(e) => setContentType(e.target.value)}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    >
                                        <option value="course">📚 Cours complet</option>
                                        <option value="exercises">✏️ Exercices avec corrigés</option>
                                        <option value="evaluation">📝 Évaluation avec barème</option>
                                        <option value="lesson_plan">📋 Fiche de préparation</option>
                                        <option value="worksheet">📄 Fiche d'activités</option>
                                        <option value="summary">📖 Fiche de révision</option>
                                    </select>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                        5️⃣ Sujet / Thème *
                                    </label>
                                    <input
                                        type="text"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="Ex: Les fractions, Le passé composé, La photosynthèse..."
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                        6️⃣ Instructions supplémentaires (optionnel)
                                    </label>
                                    <textarea
                                        value={additionalInstructions}
                                        onChange={(e) => setAdditionalInstructions(e.target.value)}
                                        rows="3"
                                        placeholder="Ex: Inclure des exemples concrets, Adapter au contexte sénégalais, Niveau de difficulté progressif..."
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'Arial' }}
                                    />
                                </div>

                                <button
                                    onClick={generateContent}
                                    disabled={isGenerating || !topic}
                                    style={{
                                        width: '100%',
                                        padding: '15px',
                                        backgroundColor: isGenerating ? '#ccc' : '#2c5f2d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {isGenerating ? '⏳ Génération en cours...' : '✨ Générer le contenu'}
                                </button>
                            </>
                        )}

                        {/* Contenu généré */}
                        {generatedContent && (
                            <div style={{ marginTop: '30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0, color: '#2c5f2d' }}>✅ Contenu généré</h3>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={copyToClipboard}
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
                                            📋 Copier
                                        </button>
                                        <button
                                            onClick={exportToPDF}
                                            style={{
                                                padding: '8px 15px',
                                                backgroundColor: '#FF9800',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            📄 PDF
                                        </button>
                                        <button
                                            onClick={saveContent}
                                            style={{
                                                padding: '8px 15px',
                                                backgroundColor: '#4CAF50',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            💾 Sauvegarder
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '20px',
                                    backgroundColor: '#f9f9f9',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    maxHeight: '600px',
                                    overflowY: 'auto'
                                }}>
                                    {generatedContent}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panneau des contenus sauvegardés */}
                    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0, color: '#2c5f2d' }}>📚 Contenus sauvegardés</h3>

                        {savedContents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
                                Aucun contenu sauvegardé
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {savedContents.map(content => (
                                    <div key={content.id} style={{
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#2c5f2d' }}>
                                                {content.topic}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteContent(content.id);
                                                }}
                                                style={{
                                                    padding: '2px 8px',
                                                    backgroundColor: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                                            {content.levelName} • {content.className} • {content.subjectName}
                                        </div>
                                        <button
                                            onClick={() => loadSavedContent(content)}
                                            style={{
                                                width: '100%',
                                                padding: '6px',
                                                backgroundColor: '#2196F3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            📖 Charger
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<GenerateurContenus />);