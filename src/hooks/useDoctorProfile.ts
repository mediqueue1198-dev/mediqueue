import { useState, useEffect } from 'react'
import doctorsService from '@/services/doctors.service'
import { Doctor } from '@/types/queue'

export function useDoctorProfile(userId: string | undefined) {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
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
