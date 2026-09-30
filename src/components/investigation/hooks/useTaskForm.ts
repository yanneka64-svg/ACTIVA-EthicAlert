/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Formulaire « + Nouvelle tâche ».
 *
 * État du formulaire et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * les modales et sections qui les reçoivent en props sont inchangées.
 */
import React, { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, CaseTask, TaskPriority } from '../../../types';

export function useTaskForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Phase 6) === Task form inputs
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskOwnerId, setTaskOwnerId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');

  // === AMÉLIORATION AJOUTÉE (Phase 6) === Task management, via the Phase 1
  // storage.addTask/updateTask pair — same audit+notify pattern as every
  // other mutation here.
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskOwnerId || !taskDueDate || !selectedAlert) return;

    const newTask: CaseTask = {
      id: 'tsk-' + Date.now(),
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      owner: taskOwnerId,
      dueDate: taskDueDate,
      priority: taskPriority,
      status: 'not_started',
      createdAt: new Date().toISOString(),
      createdBy: activeUser.id,
    };

    storage.addTask(selectedAlert.id, newTask, activeUser);

    setTaskTitle('');
    setTaskDescription('');
    setTaskOwnerId('');
    setTaskDueDate('');
    setTaskPriority('medium');
    setShowAddTaskModal(false);
  };

  return {
    showAddTaskModal,
    setShowAddTaskModal,
    taskTitle,
    setTaskTitle,
    taskDescription,
    setTaskDescription,
    taskOwnerId,
    setTaskOwnerId,
    taskDueDate,
    setTaskDueDate,
    taskPriority,
    setTaskPriority,
    handleAddTask,
  };
}
