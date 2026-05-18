import { useState, useEffect } from 'react'
import { Search, FileText, Phone, Mail, Users, Calendar } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import { appointmentsService } from '@/services/appointments.service'
import { patientsService } from '@/services/patients.service'
import { formatDate } from '@/utils/helpers'

export default function PatientHistory() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedFamilyMember, setSelectedFamilyMember] = useState(null)
  const [records, setRecords] = useState([])
  const [familyMembers, setFamilyMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

  useEffect(() => {
    const loadPatients = async () => {
      if (!user?.id) return
      setIsLoading(true)
      try {
        const { doctorsService } = await import('@/services/doctors.service')
        const doctor = await doctorsService.getByUserId(user.id)
        
        if (!doctor) {
          setPatients([])
          setIsLoading(false)
          return
        }

        const appointments = await appointmentsService.getAll({ doctor_id: doctor.id })
        
        const uniquePatientIds = [...new Set(appointments.map(a => a.patient_id))]
        
        if (uniquePatientIds.length === 0) {
          setPatients([])
          setIsLoading(false)
          return
        }

        const patientsData = await patientsService.getAll({ userIds: uniquePatientIds })
        setPatients(patientsData || [])
      } catch (err) {
        console.error('Failed to load patients:', err)
        setPatients([])
      } finally {
        setIsLoading(false)
      }
    }

    loadPatients()
  }, [user?.id])

  useEffect(() => {
    if (!selectedPatient && !selectedFamilyMember) {
      setRecords([])
      setFamilyMembers([])
      return
    }

    const loadData = async () => {
      setIsLoadingRecords(true)
      try {
        let patientId = selectedPatient?.id
        
        if (selectedFamilyMember) {
          const memberRecords = await patientsService.getMedicalRecords(selectedFamilyMember.patient_id)
          setRecords(memberRecords || [])
        } else {
          // Now using p.id (Patient ID) instead of User ID
          const patientRecords = await patientsService.getMedicalRecords(selectedPatient.id)
          setRecords(patientRecords || [])
          
          const members = await patientsService.getFamilyMembers(selectedPatient.user_id)
          setFamilyMembers(members || [])
        }
      } catch (err) {
        console.error('Failed to load data:', err)
        setRecords([])
        setFamilyMembers([])
      } finally {
        setIsLoadingRecords(false)
      }
    }

    loadData()
  }, [selectedPatient?.id, selectedFamilyMember?.id])

  const filteredPatients = patients.filter(p =>
    p.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.user?.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <DashboardLayout title="Patient History" subtitle="View patient medical records">
        <LoadingSpinner className="py-16" label="Loading patients..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Patient History" subtitle="View patient medical records">
      <div className="max-w-5xl mx-auto flex gap-5 h-[calc(100vh-180px)]">
        {/* Patients list */}
        <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-surface-100 shadow-soft flex flex-col overflow-hidden">
          <div className="p-3 border-b border-surface-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredPatients.length === 0 ? (
              <div className="p-4 text-center text-surface-500 text-sm">
                No patients found
              </div>
            ) : (
              filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPatient(p)
                    setSelectedFamilyMember(null)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 border-b border-surface-50 transition-colors ${
                    selectedPatient?.id === p.id && !selectedFamilyMember ? 'bg-primary-50' : ''
                  }`}
                >
                  <Avatar name={p.user?.full_name} size="md" className="w-10 h-10" />
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-800 truncate">{p.user?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-surface-500 truncate">{p.user?.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Patient Details & Records */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {!selectedPatient ? (
            <EmptyState icon={FileText} title="Select a patient" description="Click a patient to view their medical history." className="bg-white rounded-2xl shadow-soft border border-surface-100 py-16" />
          ) : isLoadingRecords ? (
            <LoadingSpinner className="py-16" label="Loading records..." />
          ) : (
            <>
              {/* Patient Info Card */}
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar name={selectedPatient.user?.full_name} size="xl" className="w-16 h-16" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-surface-800">
                        {selectedPatient.user?.full_name || 'Unknown Patient'}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-surface-600">
                        {selectedPatient.user?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" /> {selectedPatient.user.phone}
                          </span>
                        )}
                        {selectedPatient.user?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" /> {selectedPatient.user.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Family Members Section */}
              {familyMembers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" /> Family Members ({familyMembers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="pt-2">
                    <div className="space-y-2">
                      {familyMembers.map(member => (
                        <button
                          key={member.id}
                          onClick={() => setSelectedFamilyMember(member)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            selectedFamilyMember?.id === member.id 
                              ? 'bg-primary-50 border border-primary-200' 
                              : 'bg-surface-50 hover:bg-surface-100'
                          }`}
                        >
                          <Avatar name={member.name} size="sm" className="w-8 h-8" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-surface-800">{member.name}</p>
                            <p className="text-xs text-surface-500">{member.relationship}</p>
                          </div>
                          {member.date_of_birth && (
                            <span className="text-xs text-surface-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(member.date_of_birth)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Medical Records */}
              {selectedFamilyMember && (
                <div className="mb-2">
                  <button 
                    onClick={() => setSelectedFamilyMember(null)}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    ← Back to {selectedPatient.user?.full_name}'s records
                  </button>
                </div>
              )}
              
              {selectedFamilyMember && (
                <Card className="border-2 border-primary-200">
                  <CardBody className="p-3">
                    <p className="text-sm font-medium text-primary-700">
                      Viewing records for: {selectedFamilyMember.name} ({selectedFamilyMember.relationship})
                    </p>
                  </CardBody>
                </Card>
              )}

              {records.length === 0 ? (
                <EmptyState 
                  icon={FileText} 
                  title="No records" 
                  description={`No medical records found for ${selectedFamilyMember ? selectedFamilyMember.name : selectedPatient.user?.full_name || 'this patient'}`} 
                  className="bg-white rounded-2xl shadow-soft border border-surface-100 py-16" 
                />
              ) : (
                records.map(rec => (
                  <Card key={rec.id}>
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-bold text-surface-800">{rec.diagnosis}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {rec.doctor?.user?.full_name && (
                              <p className="text-xs text-surface-500">Dr. {rec.doctor.user.full_name}</p>
                            )}
                            <span className="text-xs text-surface-300">•</span>
                            <p className="text-xs text-surface-500">{formatDate(rec.created_at)}</p>
                          </div>
                        </div>
                      </div>
                      {rec.notes && <p className="text-sm text-surface-600 mb-3">{rec.notes}</p>}
                      {rec.prescription && rec.prescription.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-surface-500 uppercase">Prescription</p>
                          {rec.prescription.map((med, i) => (
                            <div key={i} className="bg-medical-50 rounded-lg px-3 py-2 text-sm">
                              <span className="font-medium text-medical-800">{med.name} {med.dosage}</span>
                              {(med.frequency || med.duration) && (
                                <span className="text-medical-600 ml-2">
                                  {med.frequency && `• ${med.frequency}`} {med.duration && `• ${med.duration}`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}