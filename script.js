/*
 * SCRIPT CLIENT (FRONTEND) - VERSION FINALE (VALIDÉE)
 * Gère l'interaction avec la page HTML et l'API Google Sheets
 *
 * CORRECTIONS INCLUSES :
 * 1. [DATE] Utilise .toLocaleDateString('fr-CA') pour éviter le bug de fuseau horaire.
 * 2. [CORS] Envoie les données en text/plain pour éviter l'erreur "Failed to fetch".
 * 3. [UX] Bloque visuellement les heures hors créneaux (min/max).
 * 4. [SECURITÉ] Empêche la soumission si l'heure dépasse la fermeture.
 */

// ----------------------------------------------------------------
// URL DE L'API APPS SCRIPT
const GAS_URL = "https://script.google.com/macros/s/AKfycbxuHIOaJrAwoqyxixiONlDa3Xya7E7FwOJWe-MQiI9Z6XNiUWk4_XX10FYTF2bMcKI2vA/exec";
// ----------------------------------------------------------------


// --- Variables globales pour stocker les données ---
let allAppointments = [];
let allAvailabilities = [];


// --- Sélection des éléments HTML (DOM) ---
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
    
    // --- Liste des prochaines ouvertures ---
    const upcomingListDisplay = document.getElementById('upcoming-availability-list');


    // --- Écouteurs d'événements ---

    // 1. Slider durée
    durationSlider.addEventListener('input', () => {
        durationValue.textContent = durationSlider.value;
    });

    // 2. Changement de date
    datePicker.addEventListener('change', handleDateChange);

    // 3. Soumission du formulaire
    bookingForm.addEventListener('submit', handleFormSubmit);

    // --- Chargement initial ---
    loadInitialData();


    // --- Fonctions principales ---

    /**
     * Charge les données depuis Google Sheets
     */
    async function loadInitialData() {
        upcomingListDisplay.innerHTML = "<p>Chargement des prochaines ouvertures...</p>";
        availabilityDisplay.innerHTML = "<p>Veuillez sélectionner une date ci-dessus.</p>";

        try {
            const response = await fetch(GAS_URL);
            if (!response.ok) {
                throw new Error("Erreur réseau (code: " + response.status + ")");
            }
            const data = await response.json();

            if (data.status === "success") {
                allAppointments = data.rdv;
                allAvailabilities = data.disponibilites;
                
                renderUpcomingList(14); 
                
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
     * Affiche la liste des prochains jours ouverts
     */
    function renderUpcomingList(daysToShow) {
        let html = "<h4>Prochaines ouvertures :</h4><ul>";
        let openDaysFound = 0; 
        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        for (let i = 0; i < daysToShow; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            
            // [FIX TIMEZONE] Formatage robuste "AAAA-MM-JJ" en heure locale
            const dateStr = day.toLocaleDateString('fr-CA'); 
            
            const formattedDate = new Intl.DateTimeFormat('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
            }).format(day);

            const availability = allAvailabilities.find(a => a.date.startsWith(dateStr));
            
            if (availability && availability.openTime) {
                html += `<li><span class="summary-open">✅ ${formattedDate} : ${availability.openTime} - ${availability.closeTime}</span></li>`;
                openDaysFound++;
            }
        }
        
        if (openDaysFound === 0) {
            html += "<li>Aucune date d'ouverture n'est prévue pour le moment.</li>";
        }

        html += "</ul>";
        upcomingListDisplay.innerHTML = html;
    }


    /**
     * Gère le changement de date dans le sélecteur
     */
    function handleDateChange() {
        const selectedDate = datePicker.value;
        if (!selectedDate) {
            availabilityDisplay.innerHTML = "<p>Veuillez sélectionner une date ci-dessus.</p>";
            return;
        }
        renderAvailability(selectedDate);
    }


    /**
     * Affiche les détails pour une date spécifique
     */
    function renderAvailability(selectedDate) {
        const availability = allAvailabilities.find(a => a.date.startsWith(selectedDate));
        const appointmentsForDay = allAppointments.filter(rdv => rdv.date.startsWith(selectedDate));
        
        // Récupération de l'input heure pour mettre les limites
        const timeInput = document.getElementById('time-input'); 

        let html = "";

        if (availability && availability.openTime) {
            html += `<h3>Détails pour le ${selectedDate}</h3>`;
            html += `<p>✅ Ouvert de <strong>${availability.openTime}</strong> à <strong>${availability.closeTime}</strong></p>`;
            
            // [NOUVEAU] Contraintes visuelles HTML5 (min/max)
            timeInput.min = availability.openTime;
            timeInput.max = availability.closeTime;

            if (appointmentsForDay.length > 0) {
                html += "<h4>Rendez-vous déjà planifiés :</h4><ul>";
                
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
            // Cas où c'est fermé
            html += `<h3>Détails pour le ${selectedDate}</h3>`;
            html += "<p>❌ Le coiffeur n'est pas disponible ce jour-là.</p>";
            
            // On nettoie et désactive les limites si fermé
            timeInput.value = "";
            timeInput.removeAttribute('min');
            timeInput.removeAttribute('max');
        }

        availabilityDisplay.innerHTML = html;
    }


    /**
     * Traitement du formulaire de réservation
     */
    async function handleFormSubmit(event) {
        event.preventDefault(); 

        const newRdv = {
            date: datePicker.value,
            time: timeInput.value,
            duration: parseInt(durationSlider.value, 10),
            client_name: clientName.value,
            client_email: clientEmail.value,
            message: clientMessage.value
        };

        // 1. Vérification basique
        if (!newRdv.date || !newRdv.time) {
            showToast("Veuillez choisir une date et une heure.", "error");
            return;
        }

        // [NOUVEAU] 2. Validation stricte des horaires d'ouverture
        const availability = allAvailabilities.find(a => a.date.startsWith(newRdv.date));

        if (!availability || !availability.openTime) {
            showToast("Le salon est fermé à cette date.", "error");
            return;
        }

        const closingTime = availability.closeTime;
        const rdvEnd = addMinutes(newRdv.time, newRdv.duration); // Utilise la fonction utilitaire

        // Vérifie si l'heure est avant l'ouverture OU si la fin est après la fermeture
        if (newRdv.time < availability.openTime || rdvEnd > closingTime) {
            showToast(`Impossible : Le salon est ouvert de ${availability.openTime} à ${closingTime}.`, "error");
            return;
        }

        // 3. Vérification des conflits avec les autres RDV
        if (checkConflict(newRdv, allAppointments)) {
            showToast("Conflit d'horaire ! L'heure que vous avez choisie est déjà prise.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Envoi en cours...";

        try {
            // [FIX CORS] Envoi en text/plain
            const response = await fetch(GAS_URL, {
                method: "POST",
                mode: "cors", 
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(newRdv),
            });
            const result = await response.json();

            if (result.status === "success") {
                showToast("Demande de RDV envoyée avec succès ! (Statut: En attente)", "success");
                bookingForm.reset(); 
                durationValue.textContent = "30"; 
                
                await loadInitialData(); // Recharge les données
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
     * Détecte les chevauchements de RDV
     */
    function checkConflict(newRdv, existingAppointments) {
        const newStart = parseDateTime(newRdv.date, newRdv.time);
        const newEnd = new Date(newStart.getTime() + newRdv.duration * 60000); 

        const appointmentsForDay = existingAppointments.filter(
            rdv => rdv.date.startsWith(newRdv.date) && rdv.status === "confirmed" 
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


    // --- Fonctions utilitaires ---

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

    function parseDateTime(dateStr, timeStr) {
        const cleanDateStr = dateStr.split('T')[0];
        const [year, month, day] = cleanDateStr.split('-');
        const [hours, minutes] = timeStr.split(':');
        return new Date(year, month - 1, day, hours, minutes);
    }

    // [NOUVEAU] Ajoute des minutes à une heure et retourne le format HH:MM
    function addMinutes(timeStr, minutesToAdd) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes + minutesToAdd);
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    
}); // Fin du 'DOMContentLoaded'
