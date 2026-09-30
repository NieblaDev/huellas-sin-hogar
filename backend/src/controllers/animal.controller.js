import * as animalService from '../services/animal.service.js';

export const getAnimals = async (req, res) => {
  try {
    const animals = await animalService.getAllAnimals(req.query);
    res.json(animals);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar animales' });
  }
};

export const createAnimal = async (req, res) => {
  try {
    const nuevo = await animalService.createAnimal(req.body, req.user?.id);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};