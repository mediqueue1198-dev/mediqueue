import { useState, useEffect } from 'react'
import { Search, Star, Clock, Phone, MessageSquare, MapPin, Award, Calendar, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useNavigate } from 'react-router-dom'
import { getSpecialtyIcon } from '@/utils/helpers'
import { Doctor } from '@/types/queue'

export default function ExploreDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    import('@/services/doctors.service').then(({ doctorsService }) => {
      doctorsService.getAll().then((data: Doctor[]) => {
        setDoctors(data)
        setIsLoading(false)
      })
    })
  }, [])

  const specialties = [...new Set(doctors.map(d => d.specialization).filter(Boolean))]
  
  const filteredDoctors = doctors.filter(doc => {
    const searchStr = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || 
      doc.user?.full_name?.toLowerCase().includes(searchStr) ||
      doc.specialization?.toLowerCase().includes(searchStr) ||
      doc.department?.toLowerCase().includes(searchStr) ||
      doc.hospital_name?.toLowerCase().includes(searchStr) 
    
    const matchesSpecialty = !specialtyFilter || doc.specialization === specialtyFilter
    
    return matchesSearch && matchesSpecialty
  })

  const handleBookAppointment = (doctorId: string) => {
    navigate(`/patient/book?doctor=${doctorId}`)
  }

  const handleMessage = (recipientId: string) => {
    navigate(`/patient/messages?recipientId=${recipientId}`)
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Explore Doctors" subtitle="Find medical specialists in any city or country">
        <LoadingSpinner className="py-12" label="Loading doctors..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Explore Doctors" subtitle="Find medical specialists in any city or country">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, specialization, city, or country..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-surface-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-6 py-3.5 rounded-2xl border border-surface-200 bg-white shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          >
            <option value="">All Specializations</option>
            {specialties.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Doctor Grid */}
        {filteredDoctors.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No doctors found"
            description="Try searching for a different city, country, or specialization."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => (
              <Card key={doc.id} hover className="overflow-hidden group border-none shadow-md hover:shadow-xl transition-all duration-300" onClick={() => setSelectedDoctor(doc)}>
                <div className="h-2 bg-primary-500 w-full" />
                <CardBody className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar 
                      name={doc.user?.full_name} 
                      size="xl"
                      className="w-16 h-16 ring-4 ring-primary-50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-surface-900 group-hover:text-primary-600 transition-colors truncate">
                            Dr. {doc.user?.full_name || 'Doctor'}
                          </h3>
                          <p className="text-sm font-medium text-primary-600 truncate">{doc.specialization}</p>
                        </div>
                        <Badge variant={doc.is_available ? 'success' : 'neutral'} dot pulse={doc.is_available}>
                          {doc.is_available ? 'Online' : 'Away'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-surface-500 text-sm">
                      <MapPin className="w-4 h-4 text-primary-500" />
                      <span className="truncate">
                        {doc.location || doc.hospital_name || 'Hospital Not Listed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-surface-500 text-sm">
                      <Clock className="w-4 h-4 text-medical-500" />
                      <span>{doc.experience_years || 0} Years Experience</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-surface-700">{doc.rating || '4.5'}</span>
                        <span className="text-xs text-surface-400">(120+)</span>
                      </div>
                      <span className="text-sm font-bold text-primary-700">~{doc.consultation_avg_time || 15}m</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleMessage(doc.user_id) }}
                      className="flex-1 rounded-xl"
                    >
                      Chat
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleBookAppointment(doc.id) }}
                      className="flex-1 rounded-xl shadow-md shadow-primary-100"
                    >
                      Book Now
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Doctor Profile Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={() => setSelectedDoctor(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="relative bg-primary-600 p-6 rounded-t-3xl">
              <button 
                onClick={() => setSelectedDoctor(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4">
                <Avatar 
                  name={selectedDoctor.user?.full_name} 
                  size="2xl" 
                  className="w-20 h-20 border-4 border-white/30"
                />
                <div>
                  <h2 className="text-2xl font-bold text-white font-display">
                    Dr. {selectedDoctor.user?.full_name || 'Doctor'}
                  </h2>
                  <p className="text-white/80">{selectedDoctor.specialization}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={selectedDoctor.is_available ? 'success' : 'neutral'} dot className="bg-white/20 text-white border-0">
                      {selectedDoctor.is_available ? 'Available' : 'Busy'}
                    </Badge>
                    {selectedDoctor.rating && (
                      <span className="flex items-center gap-1 text-sm text-white/90 bg-white/20 px-2 py-1 rounded-full">
                        <Star className="w-3.5 h-3.5 text-warning-400 fill-warning-400" />
                        {selectedDoctor.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Quick Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface-50 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5 text-primary-600" />
                  </div>
                  <p className="text-xs text-surface-500">Experience</p>
                  <p className="font-semibold text-surface-800">{selectedDoctor.experience_years || 0} years</p>
                </div>
                <div className="bg-surface-50 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-medical-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-medical-600" />
                  </div>
                  <p className="text-xs text-surface-500">Consult Time</p>
                  <p className="font-semibold text-surface-800">{selectedDoctor.consultation_avg_time || 15} min</p>
                </div>
                <div className="bg-surface-50 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5 text-warning-600" />
                  </div>
                  <p className="text-xs text-surface-500">Daily Capacity</p>
                  <p className="font-semibold text-surface-800">{selectedDoctor.daily_capacity || 30}</p>
                </div>
                <div className="bg-surface-50 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-2 text-primary-600">
                    {getSpecialtyIcon(selectedDoctor.specialization)}
                  </div>
                  <p className="text-xs text-surface-500">Department</p>
                  <p className="font-semibold text-surface-800 text-sm">{selectedDoctor.department || 'General'}</p>
                </div>
              </div>

              {/* Bio */}
              {selectedDoctor.bio && (
                <div>
                  <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary-600" />
                    About
                  </h3>
                  <p className="text-sm text-surface-600 leading-relaxed bg-surface-50 rounded-xl p-4">
                    {selectedDoctor.bio}
                  </p>
                </div>
              )}

              {/* Education */}
              <div>
                <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary-600" />
                  Education & Qualifications
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Award className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">{selectedDoctor.education || 'Medical Degree'}</p>
                      <p className="text-xs text-surface-500">{selectedDoctor.education_institution || 'Board Certified'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  Location
                </h3>
                <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                  <div className="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-danger-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-800">{selectedDoctor.hospital_name || 'Main Medical Center'}</p>
                    {selectedDoctor.location && (
                      <p className="text-xs text-surface-500">{selectedDoctor.location}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { handleMessage(selectedDoctor.user_id); setSelectedDoctor(null); }}
                  className="flex-1"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
                <Button
                  size="lg"
                  onClick={() => { handleBookAppointment(selectedDoctor.id); setSelectedDoctor(null); }}
                  className="flex-1"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Appointment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
