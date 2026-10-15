import * as animalService from '../services/animal.service.js';

export const getAnimals = async (req, res) => {
  try {
    const animals = await animalService.getAllAnimals(req.query);
    res.json(animals);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al consultar animales' });
  }
};

export const createAnimal = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const newAnimal = await animalService.createAnimal(req.body, req.user, ip);
    res.status(201).json(newAnimal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateAnimal = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const updated = await animalService.updateAnimal(id, req.body, req.user, ip);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAnimal = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    await animalService.deleteAnimal(id, req.user, ip);
    res.json({ message: 'Animal dado de baja lógicamente con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al eliminar el animal' });
  }
};