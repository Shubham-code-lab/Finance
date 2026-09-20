import { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { variant?: 'primary' | 'danger' }
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'color' | 'size'>
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'color' | 'size'>
