import { useState, useEffect } from 'react'
import { doctorsService } from '@/services/doctors.service'

export function useDoctorProfile(userId) {
  const [doctor, setDoctor] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    doctorsService.getByUserId(userId)
      .then(setDoctor)
      .catch((err) => console.error("Error fetching doctor profile", err))
      .finally(() => setIsLoading(false))
  }, [userId])

  return { doctor, isLoading }
}
