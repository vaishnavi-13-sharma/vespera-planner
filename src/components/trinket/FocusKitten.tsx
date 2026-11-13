import { useVespera } from '../../context/VesperaContext';
import { CatArt } from './art';
import './trinket.css';

/** Your castle kitten, in spectacles, curled at the foot of the Focus Chamber candle and blinking slowly. */
export function FocusKitten() {
  const { state } = useVespera();
  if (state.settings.trinket !== 'cat') return null;
  return (
    <div role="img" aria-label="Your castle kitten, wearing glasses" className="tk-kitten">
      <CatArt mood="focus" curled viewBox="3 19 34 21" />
    </div>
  );
}
