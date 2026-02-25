import { Student } from './types';

// Fallback values used when the API is unreachable (offline mode).
// The real source of truth is Google Sheets.

export const FALLBACK_GROUP_NAME = 'СИС-12';
export const FALLBACK_CURATOR = 'Сергей Павлович Мантуленко';

export const FALLBACK_STUDENTS: Student[] = [
  { id: 1, name: 'Бреславский Леонид' },
  { id: 2, name: 'Бугай Дмитрий' },
  { id: 3, name: 'Быкадоров Николай' },
  { id: 4, name: 'Галоян Валерий' },
  { id: 5, name: 'Дудник Ярослав' },
  { id: 6, name: 'Ефимов Даниил' },
  { id: 7, name: 'Жуков Кирилл' },
  { id: 8, name: 'Козлов Артем' },
  { id: 9, name: 'Комилов Амирхан' },
  { id: 10, name: 'Литвинов Максим' },
  { id: 11, name: 'Лобачевский Вадим' },
  { id: 12, name: 'Луганский Семён' },
  { id: 13, name: 'Молчанов Дмитрий' },
  { id: 14, name: 'Нужный Роман' },
  { id: 15, name: 'Остроух Ярослав' },
  { id: 16, name: 'Подрезов Сергей' },
  { id: 17, name: 'Пыжов Илья' },
  { id: 18, name: 'Расулов Амин' },
  { id: 19, name: 'Селявка Александр' },
  { id: 20, name: 'Тен Владимир' },
  { id: 21, name: 'Фоменко Дмитрий' },
  { id: 22, name: 'Шабалин Артём' },
  { id: 23, name: 'Шарифов Тимур' },
  { id: 24, name: 'Шкабарня Александра' },
];

export const FALLBACK_SUBJECTS = [
  'Математика', 'Физика', 'Литература', 'Русский',
  'История', 'Химия', 'Информатика', 'Иностранный',
];
