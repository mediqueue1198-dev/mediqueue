import { useEffect, useState } from 'react'
import { FileText, Pill, ChevronDown, ChevronUp } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import { patientsService } from '@/services/patients.service'
import { formatDate, getSpecialtyIcon } from '@/utils/helpers'

export default function MedicalRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (!user?.id) return
    setIsLoading(true)
    patientsService.getMedicalRecords(user.id)
      .then(setRecords)
      .finally(() => setIsLoading(false))
  }, [user?.id])

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <DashboardLayout title="Medical Records" subtitle="Your complete health history">
      <div className="max-w-3xl mx-auto">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : records.length === 0 ? (
          <EmptyState icon={FileText} title="No records yet" description="Your medical records will appear here after consultations." />
        ) : (
          <div className="space-y-4">
            {records.map((rec) => (
              <Card key={rec.id}>
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {getSpecialtyIcon(rec.doctor?.specialization)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-surface-800">{rec.diagnosis}</p>
                          <p className="text-xs text-surface-500 mt-0.5">
                            {rec.doctor?.user?.full_name} • {formatDate(rec.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleExpand(rec.id)}
                          className="text-surface-400 hover:text-surface-600 flex-shrink-0 p-1"
                        >
                          {expanded[rec.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {expanded[rec.id] && (
                        <div className="mt-4 space-y-4 border-t border-surface-100 pt-4">
                          {rec.notes && (
                            <div>
                              <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-1">Doctor Notes</p>
                              <p className="text-sm text-surface-700">{rec.notes}</p>
                            </div>
                          )}

                          {rec.prescription?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <Pill className="w-3.5 h-3.5" /> Prescription
                              </p>
                              <div className="space-y-2">
                                {rec.prescription.map((med, i) => (
                                  <div key={i} className="bg-medical-50 rounded-xl p-3">
                                    <p className="font-medium text-medical-800 text-sm">{med.name} — {med.dosage}</p>
                                    <p className="text-xs text-medical-600 mt-0.5">
                                      {med.frequency} • {med.duration}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
