const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    const fullPath = path.join(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(fullPath, content);
}

replaceInFile('src/components/ui/RoleButtons.jsx', [
    ["import { useState } from 'react'", ""]
]);

replaceInFile('src/pages/auth/GoogleCallback.jsx', [
    ["const { isAuthenticated, profile, error, initialize, isInitialized, isLoading, refreshProfile } = useAuth()", "const { refreshProfile } = useAuth()"],
    ["const { data: dbProfile, error: profileError } = await supabase", "const { error: profileError } = await supabase"],
    ["const { data: finalProfile } = await supabase", "await supabase"],
    ["[navigate, refreshProfile]", "[navigate, refreshProfile, isProcessing]"]
]);

replaceInFile('src/pages/doctor/DoctorAppointments.jsx', [
    ["import { formatDateTime } from '@/utils/helpers'", ""], // wait let's just replace formatDateTime
    [/catch \(err\)/g, "catch (_err)"]
]);
// Wait let's fix DoctorAppointments.jsx properly using regex
let docAppt = fs.readFileSync(path.join(__dirname, 'src/pages/doctor/DoctorAppointments.jsx'), 'utf8');
docAppt = docAppt.replace("import { formatDateTime } from '@/utils/helpers'", "");
docAppt = docAppt.replace(/catch \(err\)/g, "catch (_err)");
fs.writeFileSync(path.join(__dirname, 'src/pages/doctor/DoctorAppointments.jsx'), docAppt);

replaceInFile('src/pages/doctor/DoctorEarnings.jsx', [
    ["const startOfWeek = new Date(today)", "new Date(today)"],
    ["const endOfWeek = new Date(today)", "new Date(today)"],
    ["const { profile } = useAuthStore()", "useAuthStore()"]
]);

let docProf = fs.readFileSync(path.join(__dirname, 'src/pages/doctor/DoctorProfile.jsx'), 'utf8');
docProf = docProf.replace(/catch \(err\)/g, "catch (_err)");
docProf = docProf.replace("const { data: errors } = await supabase", "const { error: _errors } = await supabase");
docProf = docProf.replace("const [showFeeSection, setShowFeeSection] = useState(false)", "");
docProf = docProf.replace("const { data } = await supabase", "await supabase");
docProf = docProf.replace("const userId = profile?.id", "");
fs.writeFileSync(path.join(__dirname, 'src/pages/doctor/DoctorProfile.jsx'), docProf);

replaceInFile('src/pages/doctor/PatientHistory.jsx', [
    ["const { patientId } = useParams()", "useParams()"],
    ["[profile?.hospital_id]", "[profile?.hospital_id, selectedPatient, selectedFamilyMember]"]
]);

replaceInFile('src/pages/mediator/DoctorManagement.jsx', [
    ["[profile?.hospital_id]", "[profile?.hospital_id, loadQueue]"]
]);

replaceInFile('src/pages/mediator/MediatorOperations.jsx', [
    ["const [isLoadingDoctors, setIsLoadingDoctors] = useState(false)", ""],
    ["[profile?.hospital_id]", "[profile?.hospital_id, loadQueue]"]
]);

let patAppt = fs.readFileSync(path.join(__dirname, 'src/pages/patient/PatientAppointments.jsx'), 'utf8');
patAppt = patAppt.replace("import { formatDateTime, APPOINTMENT_STATUS_CONFIG, VISIT_TYPE_CONFIG } from '@/utils/helpers'", "import { APPOINTMENT_STATUS_CONFIG, VISIT_TYPE_CONFIG } from '@/utils/helpers'");
patAppt = patAppt.replace("const { upcoming, today, past, appointments, isLoading, cancelAppointment } = useAppointments()", "const { upcoming, today, past, isLoading, cancelAppointment } = useAppointments()");
fs.writeFileSync(path.join(__dirname, 'src/pages/patient/PatientAppointments.jsx'), patAppt);

replaceInFile('src/pages/patient/PatientProfile.jsx', [
    ["import { zodResolver } from '@hookform/resolvers/zod'", ""],
    ["const [isLoading, setIsLoading] = useState(false)", ""]
]);

replaceInFile('src/pages/public/QueueDisplayBoard.jsx', [
    ["import { useState, useEffect, useMemo } from 'react'", "import { useState, useEffect } from 'react'"]
]);

console.log('Done fixing');
