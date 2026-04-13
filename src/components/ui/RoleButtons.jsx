import { useState } from 'react'
import { Stethoscope, User, Users } from 'lucide-react'
import { ROLE_CONFIG } from '@/utils/helpers'

export default function RoleButtons({ value, onChange, name, label }) {
  const roles = ['patient', 'doctor', 'mediator']

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium text-surface-700">{label}</label>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {roles.map((role) => (
          <button
            key={role}
            name={name}
            value={role}
            onClick={() => onChange?.(role)}
            className={`w-full p-4 rounded-xl border-2 border-surface-100 font-medium transition-all ${
              value === role
                ? `border-${ROLE_CONFIG[role].color}-500 bg-${ROLE_CONFIG[role].color}-100 text-${ROLE_CONFIG[role].color}-700`
                : 'border-surface-200 hover:border-surface-300 text-surface-600'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              {role === 'patient' && <User className="w-5 h-5" />}
              {role === 'doctor' && <Stethoscope className="w-5 h-5" />}
              {role === 'mediator' && <Users className="w-5 h-5" />}
              <span>{ROLE_CONFIG[role].label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}