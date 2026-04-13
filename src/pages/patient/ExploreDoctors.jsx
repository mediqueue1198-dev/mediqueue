import { useState, useEffect } from 'react'
import { Search, Star, Clock, Phone, MessageSquare, ChevronLeft, ChevronRight, MapPin, Award, Calendar, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useNavigate } from 'react-router-dom'
import { getSpecialtyIcon } from '@/utils/helpers'

export default function ExploreDoctors() {
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    import('@/services/doctors.service').then(({ doctorsService }) => {
      doctorsService.getAll().then(data => {
        setDoctors(data)
        setIsLoading(false)
      })
    })
  }, [])

  const specialties = [...new Set(doctors.map(d => d.specialization).filter(Boolean))]
  
  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.department?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesSpecialty = !specialtyFilter || doc.specialization === specialtyFilter
    
    return matchesSearch && matchesSpecialty
  })

  const handleBookAppointment = (doctorId) => {
    navigate(`/patient/book?doctor=${doctorId}`)
  }

  const handleMessage = (doctorId) => {
    navigate(`/patient/messages?doctor=${doctorId}`)
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Explore Doctors" subtitle="Find and connect with doctors">
        <LoadingSpinner className="py-12" label="Loading doctors..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Explore Doctors" subtitle="Find and connect with doctors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, specialization, or department..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
            />
          </div>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
          >
            <option value="">All Specializations</option>
            {specialties.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Results count */}
        <p className="text-sm text-surface-500">
          Showing {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''}
        </p>

        {/* Doctor Grid */}
        {filteredDoctors.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No doctors found"
            description={searchQuery || specialtyFilter 
              ? "Try adjusting your search or filters" 
              : "No doctors available at the moment"}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map((doc) => (
              <Card key={doc.id} hover className="overflow-hidden cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar 
                      name={doc.user?.full_name} 
                      size="lg"
                      className="w-14 h-14"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-surface-800 text-sm truncate">
                            {doc.user?.full_name || 'Doctor'}
                          </p>
                          <p className="text-xs text-surface-500">{doc.specialization}</p>
                        </div>
                        <Badge variant={doc.is_available ? 'success' : 'neutral'} dot>
                          {doc.is_available ? 'Available' : 'Busy'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning-500 fill-warning-500" />
                      {doc.rating || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {doc.experience_years || 0}y exp
                    </span>
                    <span className="flex items-center gap-1">
                      ~{doc.consultation_avg_time || 15} min
                    </span>
                  </div>

                  {doc.department && (
                    <p className="text-xs text-surface-400 mt-2">{doc.department}</p>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleMessage(doc.id) }}
                      className="flex-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />
                      Message
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleBookAppointment(doc.id) }}
                      className="flex-1"
                    >
                      Book
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
            <div className="relative gradient-primary p-6 rounded-t-3xl">
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
                    {selectedDoctor.user?.full_name || 'Doctor'}
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
                  <p className="text-xs text-surface-500">Patients Today</p>
                  <p className="font-semibold text-surface-800">{selectedDoctor.patients_today || 0}</p>
                </div>
                <div className="bg-surface-50 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    {getSpecialtyIcon(selectedDoctor.specialization)}
                  </div>
                  <p className="text-xs text-surface-500">Department</p>
                  <p className="font-semibold text-surface-800 text-sm">{selectedDoctor.department || 'N/A'}</p>
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

              {/* Education & Qualifications */}
              <div>
                <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary-600" />
                  Education & Qualifications
                </h3>
                <div className="space-y-2">
                  {selectedDoctor.education ? (
                    <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Award className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-800">{selectedDoctor.education}</p>
                        {selectedDoctor.education_institution && (
                          <p className="text-xs text-surface-500">{selectedDoctor.education_institution}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Award className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-800">Medical Degree</p>
                        <p className="text-xs text-surface-500">Board Certified • {selectedDoctor.experience_years || 0}+ years experience</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              {selectedDoctor.hospital_name || selectedDoctor.location && (
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
                      <p className="text-sm font-medium text-surface-800">{selectedDoctor.hospital_name || 'Main Hospital'}</p>
                      {selectedDoctor.location && (
                        <p className="text-xs text-surface-500">{selectedDoctor.location}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact */}
              {selectedDoctor.user?.phone && (
                <div>
                  <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary-600" />
                    Contact
                  </h3>
                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">{selectedDoctor.user.phone}</p>
                      <p className="text-xs text-surface-500">Direct line</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { handleMessage(selectedDoctor.id); setSelectedDoctor(null); }}
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