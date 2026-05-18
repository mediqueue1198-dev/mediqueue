import { useEffect, useState } from 'react'
import { FileText, Pill, ChevronDown, ChevronUp } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import { patientsService } from '@/services/patients.service'
import { formatDate, getSpecialtyIcon } from '@/utils/helpers'
import { MedicalRecord } from '@/types/patients'

export default function MedicalRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!user?.id) return
    setIsLoading(true)
    patientsService.getMedicalRecords(user.id)
      .then((data: MedicalRecord[]) => setRecords(data))
      .finally(() => setIsLoading(false))
  }, [user?.id])

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <DashboardLayout title="Medical Records" subtitle="Your complete health history">
      <div className="max-w-3xl mx-auto">
        {isLoading ? (
          <LoadingSpinner className="py-12" label="Loading health records..." />
        ) : records.length === 0 ? (
          <EmptyState 
            icon={FileText} 
            title="No records yet" 
            description="Your medical records will appear here after consultations." 
          />
        ) : (
          <div className="space-y-4">
            {records.map((rec) => (
              <Card key={rec.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600 flex-shrink-0">
                      {getSpecialtyIcon(rec.doctor?.specialization)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-surface-800 text-lg">{rec.diagnosis}</p>
                          <p className="text-xs text-surface-500 font-medium mt-0.5">
                            Dr. {rec.doctor?.user?.full_name || 'Medical Specialist'} • {formatDate(rec.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleExpand(rec.id)}
                          className="text-surface-400 hover:text-primary-600 flex-shrink-0 p-1 bg-surface-50 rounded-lg transition-colors"
                        >
                          {expanded[rec.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>

                      {expanded[rec.id] && (
                        <div className="mt-4 space-y-4 border-t border-surface-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          {rec.notes && (
                            <div>
                              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-1">Doctor's Observation</p>
                              <p className="text-sm text-surface-600 leading-relaxed bg-surface-50 p-3 rounded-xl border border-surface-100">
                                {rec.notes}
                              </p>
                            </div>
                          )}

                          {rec.prescription && rec.prescription.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Pill className="w-3.5 h-3.5" /> Medication Plan
                              </p>
                              <div className="space-y-2">
                                {rec.prescription.map((med: any, i: number) => (
                                  <div key={i} className="bg-medical-50/50 rounded-xl p-4 border border-medical-100/30">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-bold text-medical-800 text-sm">{med.name}</p>
                                      <Badge variant="medical" className="text-[10px]">{med.dosage}</Badge>
                                    </div>
                                    <p className="text-xs text-medical-600 font-medium">
                                      {med.frequency} • {med.duration}
                                    </p>
                                    {med.instructions && (
                                      <p className="text-[11px] text-medical-500 mt-2 italic">
                                        Note: {med.instructions}
                                      </p>
                                    )}
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
