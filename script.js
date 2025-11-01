/*
 * SCRIPT CLIENT (FRONTEND)
 * Gère l'interaction avec la page HTML et l'API Google Sheets
 */

// ----------------------------------------------------------------
// ⚠️ VÉRIFIEZ QUE C'EST VOTRE URL CORRIGÉE
const GAS_URL = "https://script.google.com/macros/s/AKfycbx2Viy2RYNT2opecfKmiyt3eGzeA4TFgeJJDHcI9DBPJYSztdG5BSrPA4b-sfqXIZwMeg/exec";
// ----------------------------------------------------------------


// --- Variables globales pour stocker les données ---
let allAppointments = [];
let allAvailabilities = [];


// --- Sélection des éléments HTML (DOM) ---
// On attend que le HTML soit chargé
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments principaux ---
    const datePicker = document.getElementById('date-picker');
    const availabilityDisplay = document.getElementById('availability-display');
    const bookingForm = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-btn');
    
    // --- Champs du formulaire ---
    const timeInput = document.getElementById('time-input');
    const durationSlider = document.getElementById('duration-slider');
    const durationValue = document.getElementById('duration-value');
    const clientName = document.getElementById('client-name');
    const clientEmail = document.getElementById('client-email');
    const clientMessage = document.getElementById('client-message');
    
    // --- Zone de notification ---
    const toastContainer = document.getElementById('toast-container');
    
    // --- NOUVEL ÉLÉMENT (Solution 2) ---
    const upcomingListDisplay = document.getElementById('upcoming-availability-list');


    // --- Écouteurs d'événements ---

    // 1. Mettre à jour la valeur du slider en temps réel
    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
    });

    // 2. MODIFIÉ : Quand la date change, on n'appelle plus fetch
    datePicker.addEventListener('change', handleDateChange);

    // 3. Envoyer le formulaire (inchangé)
    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- NOUVEAU : On charge tout au démarrage ---
    loadInitialData();


    // --- Fonctions principales ---

    /**
     * NOUVEAU (MODIFIÉ)
     * Charge TOUTES les données 1 SEULE FOIS au chargement de la page.
     */
    async function loadInitialData() {
        upcomingListDisplay.innerHTML = "<p>Chargement des prochaines ouvertures...</p>";
        availabilityDisplay.innerHTML = "<p>Veuillez sélectionner une date ci-dessus.</p>";

        try {
            // Appelle l'API (notre script doGet)
            const response = await fetch(GAS_URL);
            if (!response.ok) {
                throw new Error("Erreur réseau (code: " + response.status + ")");
            }
            const data = await response.json();

            if (data.status === "success") {
                // Stocke les données globalement
                allAppointments = data.rdv;
                allAvailabilities = data.disponibilites;
                
                // NOUVEAU : On appelle la fonction de la Solution 2
                renderUpcomingList(14); // Affiche les 14 prochains jours
                
                // Si une date est déjà sélectionnée (ex: retour en arrière), on l'affiche
                if(datePicker.value) {
                     renderAvailability(datePicker.value);
                }

            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error("Erreur (loadInitialData):", error);
            const errorMsg = `<p style="color: red;">Impossible de charger les données: ${error.message}. Vérifiez l'URL de l'API.</p>`;
            upcomingListDisplay.innerHTML = errorMsg;
            availabilityDisplay.innerHTML = "";
        }
    }

    /**
     * NOUVEAU (Solution 2)
     * Affiche la liste des X prochains jours dans la zone 'upcoming-availability-list'
     */
    function renderUpcomingList(daysToShow) {
        let html = "<h4>Prochaines ouvertures :</h4><ul>";
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normaliser à minuit

        for (let i = 0; i < daysToShow; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            
            // Format "AAAA-MM-JJ"
            const dateStr = day.toISOString().split('T')[0]; 
            
            // Formatage "Samedi 8 Nov"
            const formattedDate = new Intl.DateTimeFormat('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
            }).format(day);

            // Cherche la dispo pour ce jour dans les données déjà chargées
            const availability = allAvailabilities.find(a => a.date === dateStr);
            
            if (availability && availability.openTime) {
                // Jour ouvert
                html += `<li><span class="summary-open">✅ ${formattedDate} : ${availability.openTime} - ${availability.closeTime}</span></li>`;
            } else {
                // Jour fermé
                html += `<li><span class="summary-closed">❌ ${formattedDate} : Fermé</span></li>`;
            }
        }
        html += "</ul>";
        upcomingListDisplay.innerHTML = html;
    }


    /**
     * MODIFIÉ
     * Appelé quand l'utilisateur change la date.
     * Ne fait plus de fetch, utilise les données globales.
     */
    function handleDateChange() {
        const selectedDate = datePicker.value;
        if (!selectedDate) {
            availabilityDisplay.innerHTML = "<p>Veuillez sélectionner une date ci-dessus.</p>";
            return;
        }
        
        // On appelle directement la fonction d'affichage
        renderAvailability(selectedDate);
    }


    /**
     * INCHANGÉ (sauf un micro-texte)
     * Affiche les infos de disponibilité et les RDV pour la date choisie
     */
    function renderAvailability(selectedDate) {
        // Trouve les heures d'ouverture pour ce jour
        const availability = allAvailabilities.find(a => a.date === selectedDate);
        
        // Filtre les RDV (confirmés ou en attente) pour ce jour
        const appointmentsForDay = allAppointments.filter(rdv => rdv.date === selectedDate);

        let html = "";

        if (availability && availability.openTime) {
            html += `<h3>Détails pour le ${selectedDate}</h3>`;
            html += `<p>✅ Ouvert de <strong>${availability.openTime}</strong> à <strong>${availability.closeTime}</strong></p>`;
            
            if (appointmentsForDay.length > 0) {
                html += "<h4>Rendez-vous déjà planifiés :</h4><ul>";
                
                // Tri des RDV par heure
                appointmentsForDay.sort((a, b) => a.time.localeCompare(b.time));
                
                appointmentsForDay.forEach(rdv => {
                    const [hours, minutes] = rdv.time.split(':').map(Number);
                    const endDate = new Date(2000, 0, 1, hours, minutes + rdv.duration);
                    const endTime = endDate.toTimeString().substring(0, 5);

                    let statusClass = rdv.status === "confirmed" ? "status-confirmed" : "status-pending";

                    html += `<li class="${statusClass}"><strong>${rdv.time}</strong> à <strong>${endTime}</strong> (${rdv.duration} min) - <em>Statut: ${rdv.status}</em></li>`;
                });
                html += "</ul>";
            } else {
                html += "<p>Aucun rendez-vous pour l'instant.</p>";
            }

        } else {
            html += `<h3>Détails pour le ${selectedDate}</h3>`;
            html += "<p>❌ Le coiffeur n'est pas disponible ce jour-là.</p>";
        }

        availabilityDisplay.innerHTML = html;
    }


    /**
     * INCHANGÉ
     * Appelé quand l'utilisateur soumet le formulaire
     */
    async function handleFormSubmit(event) {
        event.preventDefault(); // Empêche la page de se recharger

        // --- 1. Récupération des données du formulaire ---
        const newRdv = {
            date: datePicker.value,
            time: timeInput.value,
            duration: parseInt(durationSlider.value, 10),
            client_name: clientName.value,
            client_email: clientEmail.value,
            message: clientMessage.value
        };

        // --- 2. Validation simple ---
        if (!newRdv.date || !newRdv.time) {
            showToast("Veuillez choisir une date et une heure.", "error");
            return;
        }

        // --- 3. Détection de chevauchement ---
        if (checkConflict(newRdv, allAppointments)) {
            showToast("Conflit d'horaire ! L'heure que vous avez choisie est déjà prise.", "error");
            return;
        }

        // --- 4. Envoi des données (POST) ---
        submitButton.disabled = true;
        submitButton.textContent = "Envoi en cours...";

        try {
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors", 
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newRdv),
            });

            const result = await response.json();

            if (result.status === "success") {
                showToast("Demande de RDV envoyée avec succès ! (Statut: En attente)", "success");
                bookingForm.reset(); 
                durationValue.textContent = "30"; 
                
                // Recharge les données pour afficher le nouveau RDV "pending"
                // On appelle loadInitialData() pour rafraîchir TOUTES les données
                await loadInitialData(); 
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Erreur (handleFormSubmit):", error);
            showToast(`Erreur lors de l'envoi: ${error.message}`, "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Envoyer la demande";
        }
    }

    /**
     * INCHANGÉ
     * Vérifie si le nouveau RDV entre en conflit avec des RDV existants
     */
    function checkConflict(newRdv, existingAppointments) {
        const newStart = parseDateTime(newRdv.date, newRdv.time);
        const newEnd = new Date(newStart.getTime() + newRdv.duration * 60000); 

        const appointmentsForDay = existingAppointments.filter(
            rdv => rdv.date === newRdv.date && rdv.status === "confirmed" 
        );

        for (const rdv of appointmentsForDay) {
            const existingStart = parseDateTime(rdv.date, rdv.time);
            const existingEnd = new Date(existingStart.getTime() + rdv.duration * 60000);

            const isOverlap = newStart < existingEnd && newEnd > existingStart;
            
            if (isOverlap) {
                return true; 
            }
        }
        return false; 
    }


    // --- Fonctions utilitaires (INCHANGÉES) ---

    /**
     * Affiche une notification "toast"
     */
    function showToast(message, type = "success") {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    /**
     * Crée un objet Date JavaScript à partir d'une date (AAAA-MM-JJ) et d'une heure (HH:MM)
     */
    function parseDateTime(dateStr, timeStr) {
        const [year, month, day] = dateStr.split('-');
        const [hours, minutes] = timeStr.split(':');
        return new Date(year, month - 1, day, hours, minutes);
    }
});
